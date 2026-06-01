const admin = require('firebase-admin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ① 환경변수 체크
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return res.status(500).json({
      error: '환경변수 누락',
      missing: {
        FIREBASE_PROJECT_ID:  !FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !FIREBASE_PRIVATE_KEY,
      }
    });
  }

  // ② Firebase Admin 초기화 (매 요청마다 체크)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  // ③ Naver 토큰 확인
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'access_token 없음' });

  // ④ Naver 사용자 정보 조회
  let naverUser;
  try {
    const naverRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await naverRes.json();
    if (!data.response) throw new Error(data.message || 'Naver 응답 없음');
    naverUser = data.response;
  } catch (e) {
    return res.status(401).json({ error: 'Naver 인증 실패: ' + e.message });
  }

  // ⑤ Firebase custom token 발급
  try {
    const uid = `naver:${naverUser.id}`;
    const customToken = await admin.auth().createCustomToken(uid, {
      provider: 'naver',
      name:     naverUser.name || '',
      email:    naverUser.email || '',
      photoURL: naverUser.profile_image || '',
    });
    return res.json({
      customToken,
      user: {
        uid,
        name:     naverUser.name || '',
        email:    naverUser.email || '',
        photoURL: naverUser.profile_image || '',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Firebase 토큰 생성 실패: ' + e.message });
  }
};
