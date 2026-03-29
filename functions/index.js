const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const FONT_MAP = require('./font-map');
const STORAGE_FOLDER = 'TK studio';

admin.initializeApp();

// ==============================
// สร้าง Payment Intent (Card & PromptPay)
// ==============================
exports.createPaymentIntent = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const Stripe = require('stripe');
    const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim(), {
      httpClient: Stripe.createNodeHttpClient(),
    });

    const { items, email, paymentMethod = 'card' } = data;

    if (!items || items.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่มีสินค้าในตะกร้า');
    }

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const hasDiscount = items.length >= 10;
    const discount = hasDiscount ? Math.round(subtotal * 0.10) : 0;
    const total = subtotal - discount;
    const amount = total * 100;

    const itemsSummary = items.map(i => i.name).join(', ');
    const metadata = {
      items: itemsSummary.length <= 500 ? itemsSummary : itemsSummary.substring(0, 497) + '...',
      item_count: String(items.length),
      userId: context.auth ? context.auth.uid : 'guest',
      email: (email || '').substring(0, 500),
    };

    try {
      if (paymentMethod === 'promptpay') {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: 'thb',
          payment_method_types: ['promptpay'],
          metadata,
        });

        const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method_data: {
            type: 'promptpay',
            billing_details: { email: email || 'noemail@example.com' },
          },
        });

        await admin.firestore().collection('orders').doc(confirmed.id).set({
          paymentIntentId: confirmed.id,
          userId: context.auth ? context.auth.uid : null,
          email: email || '',
          items,
          subtotal,
          discount,
          total,
          status: 'pending',
          paymentMethod: 'promptpay',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          paymentIntentId: confirmed.id,
          qrCodeUrl: confirmed.next_action.promptpay_display_qr_code.image_url_png,
        };
      }

      // Card payment
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'thb',
        payment_method_types: ['card'],
        metadata,
      });

      await admin.firestore().collection('orders').doc(paymentIntent.id).set({
        paymentIntentId: paymentIntent.id,
        userId: context.auth ? context.auth.uid : null,
        email: email || '',
        items,
        subtotal,
        discount,
        total,
        status: 'pending',
        paymentMethod: 'card',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };

    } catch (err) {
      console.error('createPaymentIntent error:', err.message);
      throw new functions.https.HttpsError('internal', err.message || 'Payment error');
    }
  });

// ==============================
// ตรวจสอบสถานะ PromptPay
// ==============================
exports.checkPaymentStatus = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const Stripe = require('stripe');
    const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim(), {
      httpClient: Stripe.createNodeHttpClient(),
    });
    const { paymentIntentId } = data;

    if (!paymentIntentId) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ paymentIntentId');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return { status: paymentIntent.status };
  });

// ==============================
// ดึง Download Links หลังชำระเงินสำเร็จ
// ==============================
exports.getDownloadLinks = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const Stripe = require('stripe');
    const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim(), {
      httpClient: Stripe.createNodeHttpClient(),
    });
    const { paymentIntentId } = data;

    if (!paymentIntentId) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ paymentIntentId');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      throw new functions.https.HttpsError('failed-precondition', 'การชำระเงินยังไม่สำเร็จ');
    }

    const orderDoc = await admin.firestore().collection('orders').doc(paymentIntentId).get();
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'ไม่พบคำสั่งซื้อ');
    }

    const order = orderDoc.data();

    if (order.status === 'paid' && order.downloadLinks) {
      return { downloadLinks: order.downloadLinks, items: order.items };
    }

    const bucket = admin.storage().bucket();
    const downloadLinks = {};

    for (const item of order.items) {
      const fileNames = FONT_MAP[item.name] || [];
      downloadLinks[item.name] = [];

      for (const fileName of fileNames) {
        const filePath = STORAGE_FOLDER + '/' + fileName;
        const file = bucket.file(filePath);
        try {
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
          downloadLinks[item.name].push({ fileName, url });
        } catch (e) {
          console.warn('File not found in storage:', filePath);
        }
      }

      // fallback: ถ้าไม่เจอใน font-map ให้ค้นหา folder เดิม
      if (downloadLinks[item.name].length === 0) {
        const [files] = await bucket.getFiles({ prefix: item.name + '/' });
        for (const file of files) {
          if (file.name.endsWith('/')) continue;
          const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
          downloadLinks[item.name].push({ fileName: file.name.split('/').pop(), url });
        }
      }
    }

    await admin.firestore().collection('orders').doc(paymentIntentId).update({
      status: 'paid',
      downloadLinks,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (context.auth) {
      await admin.firestore()
        .collection('users').doc(context.auth.uid)
        .collection('orders').doc(paymentIntentId)
        .set({
          paymentIntentId,
          items: order.items.map(i => ({ name: i.name, license: i.license, price: i.price })),
          total: order.total,
          status: 'paid',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          downloadLinks,
        });
    }

    return { downloadLinks, items: order.items };
  });
