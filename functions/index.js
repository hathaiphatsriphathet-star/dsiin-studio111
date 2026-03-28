const functions = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// ==============================
// สร้าง Payment Intent
// ==============================
exports.createPaymentIntent = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const stripe = require('stripe')(stripeSecretKey.value());
    const { items, email } = data;

    if (!items || items.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่มีสินค้าในตะกร้า');
    }

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const hasDiscount = items.length >= 10;
    const discount = hasDiscount ? Math.round(subtotal * 0.10) : 0;
    const total = subtotal - discount;
    const amount = total * 100; // Stripe ใช้ satang

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'thb',
      metadata: {
        items: JSON.stringify(items.map(i => ({
          name: i.name,
          price: i.price,
          license: i.license,
        }))),
        userId: context.auth ? context.auth.uid : 'guest',
        email: email || '',
      },
    });

    // บันทึก order pending ใน Firestore
    await admin.firestore().collection('orders').doc(paymentIntent.id).set({
      paymentIntentId: paymentIntent.id,
      userId: context.auth ? context.auth.uid : null,
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
  });

// ==============================
// ดึง Download Links หลังชำระเงินสำเร็จ
// ==============================
exports.getDownloadLinks = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const stripe = require('stripe')(stripeSecretKey.value());
    const { paymentIntentId } = data;

    if (!paymentIntentId) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ paymentIntentId');
    }

    // ตรวจสอบกับ Stripe ว่าชำระเงินสำเร็จจริง
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new functions.https.HttpsError('failed-precondition', 'การชำระเงินยังไม่สำเร็จ');
    }

    // ดึง order จาก Firestore
    const orderDoc = await admin.firestore().collection('orders').doc(paymentIntentId).get();
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'ไม่พบคำสั่งซื้อ');
    }

    const order = orderDoc.data();

    // ป้องกัน generate ซ้ำ
    if (order.status === 'paid' && order.downloadLinks) {
      return { downloadLinks: order.downloadLinks, items: order.items };
    }

    // สร้าง signed URL จาก Firebase Storage
    const bucket = admin.storage().bucket();
    const downloadLinks = {};

    for (const item of order.items) {
      const fontFolder = item.name; // เช่น "ฟอนต์เป็ดน้อย"
      const [files] = await bucket.getFiles({ prefix: fontFolder + '/' });

      downloadLinks[item.name] = [];
      for (const file of files) {
        if (file.name.endsWith('/')) continue;
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 วัน
        });
        const fileName = file.name.split('/').pop();
        downloadLinks[item.name].push({ fileName, url });
      }
    }

    // อัปเดต order เป็น paid
    await admin.firestore().collection('orders').doc(paymentIntentId).update({
      status: 'paid',
      downloadLinks,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // บันทึกใน user's order history ถ้า login อยู่
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
