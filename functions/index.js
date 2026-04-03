const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');
const FONT_MAP = require('./font-map');
const STORAGE_FOLDER = 'TK studio';
const STORAGE_BUCKET = 'dsiinstodio.firebasestorage.app';

// Lazy initialization เพื่อป้องกัน hang ตอน Firebase CLI วิเคราะห์ code
function getAdmin() {
  if (!admin.apps.length) admin.initializeApp();
  return admin;
}

// สร้าง download URL จาก metadata token
async function getFileDownloadUrl(bucket, filePath) {
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [metadata] = await file.getMetadata();
  const token = metadata.metadata && metadata.metadata.firebaseStorageDownloadTokens;
  if (!token) return null;
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${token}`;
}

// เรียก Omise REST API
function omiseRequest(secretKey, method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? new URLSearchParams(body).toString() : '';
    const options = {
      hostname: 'api.omise.co',
      path,
      method,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.object === 'error') {
            reject(new Error(parsed.message));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ==============================
// สร้าง Charge (Card & PromptPay)
// ==============================
exports.createPaymentIntent = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['OMISE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const secretKey = (process.env.OMISE_SECRET_KEY || '').trim();
    const { items, email, paymentMethod = 'card', token } = data;

    if (!items || items.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่มีสินค้าในตะกร้า');
    }

    const invalidItems = items.filter(item => !item.name || !FONT_MAP[item.name]);
    if (invalidItems.length > 0) {
      throw new functions.https.HttpsError('invalid-argument', `ไม่พบฟอนต์ในระบบ: ${invalidItems.map(i => i.name || '(ไม่มีชื่อ)').join(', ')}`);
    }

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const hasDiscount = items.length >= 10;
    const discount = hasDiscount ? Math.round(subtotal * 0.10) : 0;
    const total = subtotal - discount;
    const amount = total * 100;

    const itemsSummary = items.map(i => i.name).join(', ');
    const description = itemsSummary.length <= 500 ? itemsSummary : itemsSummary.substring(0, 497) + '...';

    try {
      if (paymentMethod === 'promptpay') {
        // สร้าง Source สำหรับ PromptPay
        const source = await omiseRequest(secretKey, 'POST', '/sources', {
          type: 'promptpay',
          amount,
          currency: 'thb',
        });

        // สร้าง Charge จาก Source
        const charge = await omiseRequest(secretKey, 'POST', '/charges', {
          amount,
          currency: 'thb',
          source: source.id,
          description,
          'metadata[items]': description,
          'metadata[item_count]': String(items.length),
          'metadata[userId]': context.auth ? context.auth.uid : 'guest',
          'metadata[email]': (email || '').substring(0, 500),
        });

        await getAdmin().firestore().collection('orders').doc(charge.id).set({
          chargeId: charge.id,
          userId: context.auth ? context.auth.uid : null,
          email: email || '',
          items,
          subtotal,
          discount,
          total,
          status: 'pending',
          paymentMethod: 'promptpay',
          createdAt: getAdmin().firestore.FieldValue.serverTimestamp(),
        });

        return {
          chargeId: charge.id,
          qrCodeUrl: charge.source.scannable_code.image.download_uri,
        };
      }

      // Card payment
      if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ token บัตร');
      }

      const charge = await omiseRequest(secretKey, 'POST', '/charges', {
        amount,
        currency: 'thb',
        card: token,
        description,
        'metadata[items]': description,
        'metadata[item_count]': String(items.length),
        'metadata[userId]': context.auth ? context.auth.uid : 'guest',
        'metadata[email]': (email || '').substring(0, 500),
      });

      await getAdmin().firestore().collection('orders').doc(charge.id).set({
        chargeId: charge.id,
        userId: context.auth ? context.auth.uid : null,
        email: email || '',
        items,
        subtotal,
        discount,
        total,
        status: charge.status === 'successful' ? 'paid' : 'pending',
        paymentMethod: 'card',
        createdAt: getAdmin().firestore.FieldValue.serverTimestamp(),
      });

      return {
        chargeId: charge.id,
        status: charge.status,
      };

    } catch (err) {
      console.error('createPaymentIntent error:', err.message);
      throw new functions.https.HttpsError('internal', 'เกิดข้อผิดพลาดในการชำระเงิน กรุณาลองใหม่');
    }
  });

// ==============================
// ตรวจสอบสถานะ PromptPay
// ==============================
exports.checkPaymentStatus = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['OMISE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const secretKey = (process.env.OMISE_SECRET_KEY || '').trim();
    const { chargeId } = data;

    if (!chargeId) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ chargeId');
    }

    const charge = await omiseRequest(secretKey, 'GET', `/charges/${chargeId}`, null);
    return { status: charge.status };
  });

// ==============================
// ดึง Download Links หลังชำระเงินสำเร็จ
// ==============================
exports.getDownloadLinks = functions
  .region('asia-southeast1')
  .runWith({ secrets: ['OMISE_SECRET_KEY'] })
  .https.onCall(async (data, context) => {
    const secretKey = (process.env.OMISE_SECRET_KEY || '').trim();
    const { chargeId } = data;

    if (!chargeId) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ chargeId');
    }

    const charge = await omiseRequest(secretKey, 'GET', `/charges/${chargeId}`, null);
    if (charge.status !== 'successful') {
      throw new functions.https.HttpsError('failed-precondition', 'การชำระเงินยังไม่สำเร็จ');
    }

    const orderDoc = await getAdmin().firestore().collection('orders').doc(chargeId).get();
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'ไม่พบคำสั่งซื้อ');
    }

    const order = orderDoc.data();

    if (order.status === 'paid' && order.downloadLinks) {
      return { downloadLinks: order.downloadLinks, items: order.items };
    }

    const bucket = getAdmin().storage().bucket(STORAGE_BUCKET);
    const downloadLinks = {};

    const needsFallback = order.items.some(item => (FONT_MAP[item.name] || []).length === 0);
    let allBucketFiles = null;
    if (needsFallback) {
      try {
        [allBucketFiles] = await bucket.getFiles({ prefix: STORAGE_FOLDER + '/' });
      } catch (e) {
        console.warn('Bucket scan failed:', e.message);
      }
    }

    for (const item of order.items) {
      const fileNames = FONT_MAP[item.name] || [];
      downloadLinks[item.name] = [];

      for (const fileName of fileNames) {
        const filePath = STORAGE_FOLDER + '/' + fileName;
        const url = await getFileDownloadUrl(bucket, filePath);
        if (url) {
          downloadLinks[item.name].push({ fileName, url });
        } else {
          console.warn('File not found:', filePath);
        }
      }

      if (downloadLinks[item.name].length === 0 && allBucketFiles) {
        const lowerName = item.name.toLowerCase().replace(/\s+/g, '');
        for (const file of allBucketFiles) {
          if (file.name.endsWith('/')) continue;
          const baseName = file.name.split('/').pop().toLowerCase().replace(/\s+/g, '');
          if (baseName.includes(lowerName) || lowerName.includes(baseName.replace(/\.(ttf|otf)$/, ''))) {
            const url = await getFileDownloadUrl(bucket, file.name);
            if (url) downloadLinks[item.name].push({ fileName: file.name.split('/').pop(), url });
          }
        }
      }
    }

    await getAdmin().firestore().collection('orders').doc(chargeId).update({
      status: 'paid',
      downloadLinks,
      paidAt: getAdmin().firestore.FieldValue.serverTimestamp(),
    });

    if (context.auth) {
      await getAdmin().firestore()
        .collection('users').doc(context.auth.uid)
        .collection('orders').doc(chargeId)
        .set({
          chargeId,
          items: order.items.map(i => ({ name: i.name, license: i.license, price: i.price })),
          total: order.total,
          status: 'paid',
          paidAt: getAdmin().firestore.FieldValue.serverTimestamp(),
          downloadLinks,
        });
    }

    return { downloadLinks, items: order.items };
  });

// ==============================
// [DIAGNOSTIC] ลิสต์ไฟล์ใน Storage (ลบออกหลังใช้)
// ==============================
exports.listStorageFiles = functions
  .region('asia-southeast1')
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'ต้อง login');
    const bucket = getAdmin().storage().bucket(STORAGE_BUCKET);
    const [files] = await bucket.getFiles({ prefix: 'TK studio/' });
    return files.map(f => f.name).filter(n => !n.endsWith('/'));
  });
