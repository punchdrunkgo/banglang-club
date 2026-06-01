// Vercel 서버리스 함수
// 역할: Naver access_token → Naver 사용자 정보 조회 → Firebase custom token 발급
// 환경변수 필요: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from 'firebase-admin';

// Firebase Admin 초기화 (cold start 시 한 번만)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    if (!data.response) throw new Error(data.message || 'Naver API 오류');
    naverUser = data.response;
  } catch (e) {
    return res.status(401).json({ error: '유효하지 않은 네이버 토큰: ' + e.message });
  }

  // ② Firebase custom token 발급
  // uid: "naver:{naverId}" 형식으로 Google 계정과 구분
  const uid = `naver:${naverUser.id}`;
  try {
    const customToken = await admin.auth().createCustomToken(uid, {
      provider:  'naver',
      name:      naverUser.name || '',
      email:     naverUser.email || '',
      photoURL:  naverUser.profile_image || '',
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
    return res.status(500).json({ error: 'Firebase custom token 생성 실패: ' + e.message });
  }
}
