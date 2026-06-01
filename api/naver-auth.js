// Vercel 서버리스 함수 (CommonJS)
// Naver access_token → Naver 프로필 조회 → Firebase custom token 발급

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error('Firebase Admin 초기화 실패:', e.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'access_token이 없습니다.' });
  }

  // ① Naver 사용자 정보 조회
  let naverUser;
  try {
    const naverRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await naverRes.json();
    console.log('Naver API 응답:', JSON.stringify(data));
    if (!data.response) throw new Error(data.message || 'Naver 사용자 정보 없음');
    naverUser = data.response;
  } catch (e) {
    console.error('Naver API 오류:', e.message);
    return res.status(401).json({ error: 'Naver 인증 실패: ' + e.message });
  }

  // ② Firebase custom token 발급
  const uid = `naver:${naverUser.id}`;
  try {
    const customToken = await admin.auth().createCustomToken(uid, {
      provider: 'naver',
      name:     naverUser.name     || '',
      email:    naverUser.email    || '',
      photoURL: naverUser.profile_image || '',
    });
    return res.json({
      customToken,
      user: {
        uid,
        name:     naverUser.name     || '',
        email:    naverUser.email    || '',
        photoURL: naverUser.profile_image || '',
      },
    });
  } catch (e) {
    console.error('Firebase custom token 오류:', e.message);
    return res.status(500).json({ error: 'Firebase 토큰 생성 실패: ' + e.message });
  }
};
