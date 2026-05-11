const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');
const FONT_MAP = require('./font-map');
const STORAGE_FOLDER = 'TK studio';
const STORAGE_BUCKET = 'dsiinstodio.firebasestorage.app';

// ราคา Personal & Commercial Use สำหรับแต่ละฟอนต์ (default = 149)
const PERSONAL_PRICES_139 = new Set([
  'ฟอนต์ คามิน','ฟอนต์ ลูกพีช','ฟอนต์ พาสต้า','ฟอนต์ ม้าเต่อ','ฟอนต์ ลานดอกไม้',
  'ฟอนต์ฟองนม','ฟอนต์ขาหมู','ฟอนต์วีนัส','ฟอนต์กะเพรา','ฟอนต์มาสคอส',
  'ฟอนต์อันโกะ','ฟอนต์ฮิปปี้','ฟอนต์เมนเดล','ฟอนต์แอนลีน','ฟอนต์ครีมพัฟ',
  'ฟอนต์ชีสเค้ก','ฟอนต์ซินเทีย','ฟอนต์บัลเลต์','ฟอนต์มอร์แกน','ฟอนต์มัลเฟิล',
  'ฟอนต์หมอนทอง','ฟอนต์เมเจอร์','ฟอนต์คาเทียร์','ฟอนต์ซัมเมอร์','ฟอนต์ธันเดอร์',
  'ฟอนต์ฟิกเกอร์','ฟอนต์เมอร์ลิน','ฟอนต์ข้าวกล่อง','ฟอนต์เมเปิล','ฟอนต์สตีเวีย',
  'ฟอนต์มอเตอร์','ฟอนต์อร่อยมาก','ฟอนต์แครอท','ฟอนต์ไซโคลน','ฟอนต์ไดอาน่า',
  'ฟอนต์มินาโกะ',
]);

// ราคาพิเศษเฉพาะรายฟอนต์ (ไม่ใช่ 139 หรือ 149)
const PRICE_OVERRIDES = {
  'ฟอนต์หมูกรอบ': { personal: 159, company: 1300 },
  'ฟอนต์อิโมจิEp.1': { personal: 129, company: 700 },
  'ฟอนต์อิโมจิEp.2': { personal: 129, company: 700 },
  'ฟอนต์อิโมจิEp.3': { personal: 99, company: 700 },
  'ฟอนต์อิโมจิEp.4': { personal: 129, company: 700 },
  'ฟอนต์อิโมจิEp.5': { personal: 99, company: 700 },
  'ฟอนต์อิโมจิEp.6': { personal: 129, company: 700 },
  'ฟอนต์อิโมจิEp.7': { personal: 99, company: 700 },
  'ฟอนต์อิโมจิEp.8': { personal: 129, company: 700 },
  'ฟอนต์อิโมจิEp.9': { personal: 129, company: 700 },
  'SET:อิโมจิ': {
    'Personal & Commercial Use': 888,
    'Freelance Use': 4200,
    'Sticker Line Use': 2200,
    'Company & Organization Use': 6000,
  },
};

const VALID_LICENSES = new Set([
  'Personal & Commercial Use',
  'Freelance Use',
  'Sticker Line Use',
  'Company & Organization Use',
]);

function getExpectedPrice(fontName, license) {
  if (!VALID_LICENSES.has(license)) return null;

  // SET:อิโมจิ มีราคาเฉพาะทุก license
  const setOverride = PRICE_OVERRIDES[fontName];
  if (setOverride && typeof setOverride[license] === 'number') {
    return setOverride[license];
  }

  const override = PRICE_OVERRIDES[fontName];
  const personalPrice = override ? override.personal
    : PERSONAL_PRICES_139.has(fontName) ? 139 : 149;

  if (license === 'Personal & Commercial Use') return personalPrice;
  if (license === 'Freelance Use') return 500;
  if (license === 'Sticker Line Use') return 300;
  if (license === 'Company & Organization Use') {
    if (override && override.company) return override.company;
    return personalPrice === 139 ? 900 : 1300;
  }
  return null;
}

admin.initializeApp();

function getAdmin() {
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
// Rate Limiter (Firestore-based)
// ==============================
async function checkRateLimit(uid, action, maxCalls, windowSec) {
  const db = getAdmin().firestore();
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const key = `ratelimit_${action}_${uid}`;
  const ref = db.collection('_ratelimits').doc(key);

  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.exists ? doc.data() : { calls: [], uid, action };
      const recentCalls = (data.calls || []).filter(t => now - t < windowMs);

      if (recentCalls.length >= maxCalls) {
        return false;
      }
      recentCalls.push(now);
      tx.set(ref, { calls: recentCalls, uid, action, updatedAt: now });
      return true;
    });
    return result;
  } catch (e) {
    return true; // fail open ถ้า Firestore มีปัญหา
  }
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

    // Rate limit: 10 ครั้ง/ชั่วโมง ต่อ user
    const uid = context.auth ? context.auth.uid : `guest_${(data.email || 'unknown').replace(/[^a-z0-9]/gi, '_')}`;
    const allowed = await checkRateLimit(uid, 'createPayment', 10, 3600);
    if (!allowed) {
      throw new functions.https.HttpsError('resource-exhausted', 'คุณทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
    }

    if (!items || items.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่มีสินค้าในตะกร้า');
    }

    const invalidItems = items.filter(item => !item.name || !FONT_MAP[item.name]);
    if (invalidItems.length > 0) {
      throw new functions.https.HttpsError('invalid-argument', `ไม่พบฟอนต์ในระบบ: ${invalidItems.map(i => i.name || '(ไม่มีชื่อ)').join(', ')}`);
    }

    // ตรวจสอบ license และคำนวณราคาฝั่ง server (ป้องกัน price tampering)
    const pricedItems = items.map(item => {
      const expectedPrice = getExpectedPrice(item.name, item.license);
      if (expectedPrice === null) {
        throw new functions.https.HttpsError('invalid-argument', `ประเภทใบอนุญาตไม่ถูกต้อง: ${item.license}`);
      }
      return { ...item, price: expectedPrice };
    });

    const subtotal = pricedItems.reduce((sum, item) => sum + item.price, 0);
    const hasDiscount = items.length >= 10;
    const discount = hasDiscount ? Math.round(subtotal * 0.10) : 0;
    const total = subtotal - discount;
    const amount = total * 100;

    const itemsSummary = pricedItems.map(i => i.name).join(', ');
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
          items: pricedItems,
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
        items: pricedItems,
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

    if (!chargeId || typeof chargeId !== 'string' || !/^chrg_[a-zA-Z0-9]+$/.test(chargeId)) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ chargeId');
    }

    // Rate limit: 60 ครั้ง/ชั่วโมง ต่อ chargeId (polling protection)
    const allowed = await checkRateLimit(`charge_${chargeId}`, 'checkStatus', 60, 3600);
    if (!allowed) {
      throw new functions.https.HttpsError('resource-exhausted', 'ตรวจสอบสถานะถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
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

    if (!chargeId || typeof chargeId !== 'string' || !/^chrg_[a-zA-Z0-9]+$/.test(chargeId)) {
      throw new functions.https.HttpsError('invalid-argument', 'ไม่พบ chargeId');
    }

    // Rate limit: 20 ครั้ง/ชั่วโมง ต่อ user หรือ chargeId
    const rlKey = context.auth ? context.auth.uid : `charge_${chargeId}`;
    const allowed = await checkRateLimit(rlKey, 'getDownload', 20, 3600);
    if (!allowed) {
      throw new functions.https.HttpsError('resource-exhausted', 'ดาวน์โหลดถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
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

    // Ownership check: ถ้าเป็น logged-in order ต้องตรงกับ user ที่สร้าง
    if (order.userId && context.auth && order.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'คุณไม่มีสิทธิ์เข้าถึงคำสั่งซื้อนี้');
    }
    // ถ้า order เป็นของ logged-in user แต่ caller ไม่ได้ login → ปฏิเสธ
    if (order.userId && !context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบเพื่อดาวน์โหลด');
    }

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
