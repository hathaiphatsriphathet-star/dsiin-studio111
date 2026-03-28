const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// ==============================
// สร้าง Payment Intent
// ==============================
exports.createPaymentIntent = onCall(
  { region: 'asia-southeast1', secrets: [stripeSecretKey] },
  async (request) => {
    const stripe = require('stripe')(stripeSecretKey.value());
    const { items, email } = request.data;

    if (!items || items.length === 0) {
      throw new HttpsError('invalid-argument', 'ไม่มีสินค้าในตะกร้า');
    }

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const hasDiscount = items.length >= 10;
    const discount = hasDiscount ? Math.round(subtotal * 0.10) : 0;
    const total = subtotal - discount;
    const amount = total * 100;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'thb',
      metadata: {
        items: JSON.stringify(items.map(i => ({
          name: i.name,
          price: i.price,
          license: i.license,
        }))),
        userId: request.auth ? request.auth.uid : 'guest',
        email: email || '',
      },
    });

    await admin.firestore().collection('orders').doc(paymentIntent.id).set({
      paymentIntentId: paymentIntent.id,
      userId: request.auth ? request.auth.uid : null,
      email: email || '',
      items,
      subtotal,
      discount,
      total,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }
);

// ==============================
// ดึง Download Links หลังชำระเงินสำเร็จ
// ==============================
exports.getDownloadLinks = onCall(
  { region: 'asia-southeast1', secrets: [stripeSecretKey] },
  async (request) => {
    const stripe = require('stripe')(stripeSecretKey.value());
    const { paymentIntentId } = request.data;

    if (!paymentIntentId) {
      throw new HttpsError('invalid-argument', 'ไม่พบ paymentIntentId');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      throw new HttpsError('failed-precondition', 'การชำระเงินยังไม่สำเร็จ');
    }

    const orderDoc = await admin.firestore().collection('orders').doc(paymentIntentId).get();
    if (!orderDoc.exists) {
      throw new HttpsError('not-found', 'ไม่พบคำสั่งซื้อ');
    }

    const order = orderDoc.data();

    if (order.status === 'paid' && order.downloadLinks) {
      return { downloadLinks: order.downloadLinks, items: order.items };
    }

    const bucket = admin.storage().bucket();
    const downloadLinks = {};

    for (const item of order.items) {
      const fontFolder = item.name;
      const [files] = await bucket.getFiles({ prefix: fontFolder + '/' });

      downloadLinks[item.name] = [];
      for (const file of files) {
        if (file.name.endsWith('/')) continue;
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        const fileName = file.name.split('/').pop();
        downloadLinks[item.name].push({ fileName, url });
      }
    }

    await admin.firestore().collection('orders').doc(paymentIntentId).update({
      status: 'paid',
      downloadLinks,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (request.auth) {
      await admin.firestore()
        .collection('users').doc(request.auth.uid)
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
  }
);
