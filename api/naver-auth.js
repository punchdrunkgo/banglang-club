// Firebase custom token = RS256 JWT
// firebase-admin 없이 jsonwebtoken으로 직접 생성
const jwt            = require('jsonwebtoken');
const { createPrivateKey } = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ① 환경변수 체크
  const { FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return res.status(500).json({
      error: '환경변수 누락',
      missing: { FIREBASE_CLIENT_EMAIL: !FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY: !FIREBASE_PRIVATE_KEY }
    });
  }

  // ② Naver 토큰 확인
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'access_token 없음' });

  // ③ Naver 사용자 정보 조회
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

  // ④ Firebase custom token 생성 (RS256 JWT)
  // Firebase가 기대하는 형식: https://firebase.google.com/docs/auth/admin/create-custom-tokens
  try {
    const uid        = `naver:${naverUser.id}`;
    const now        = Math.floor(Date.now() / 1000);
    const pemString  = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
    const privateKey = createPrivateKey({ key: pemString, format: 'pem' });

    const payload = {
      iss:    FIREBASE_CLIENT_EMAIL,
      sub:    FIREBASE_CLIENT_EMAIL,
      aud:    'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat:    now,
      exp:    now + 3600,
      uid,
      claims: { provider: 'naver', name: naverUser.name || '', email: naverUser.email || '' },
    };

    const customToken = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

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
    return res.status(500).json({ error: 'JWT 생성 실패: ' + e.message });
  }
};
