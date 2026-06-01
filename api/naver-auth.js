// Node.js 내장 crypto로 Firebase custom token 생성 (외부 패키지 불필요)
const crypto = require('crypto');

function b64url(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeFirebaseToken(uid, clientEmail, privateKeyPem) {
  const now     = Math.floor(Date.now() / 1000);
  const header  = b64url({ alg: 'RS256', typ: 'JWT' });
  const payload = b64url({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
    claims: { provider: 'naver' },
  });

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(privateKeyPem, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${header}.${payload}.${sig}`;
}

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

  // ④ Firebase custom token 생성
  try {
    const uid        = `naver:${naverUser.id}`;
    const pemString  = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
    const customToken = makeFirebaseToken(uid, FIREBASE_CLIENT_EMAIL, pemString);

    return res.json({
      customToken,
      user: {
        uid,
        name:     naverUser.name          || '',
        email:    naverUser.email         || '',
        photoURL: naverUser.profile_image || '',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'JWT 생성 실패: ' + e.message });
  }
};
