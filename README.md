# 방랑클럽 (Banglang Club)

여행 고민 1:1 상담 서비스. Firebase `pack-all-c1794` 프로젝트를 Packo와 공유.

## 로컬 개발

```bash
python3 -m http.server 3001
# → http://localhost:3001
```

## 배포 (Vercel)

```bash
npx vercel
```

---

## 설정 필요 항목

### 1. Firebase 인증 도메인 추가
[Firebase Console](https://console.firebase.google.com) → `pack-all-c1794`  
→ Authentication → Settings → **승인된 도메인**  
→ `localhost` 추가  
→ (배포 후) `banglang-club.vercel.app` 추가

### 2. Firestore 보안 규칙 배포
```bash
# Firebase CLI 설치 후
firebase deploy --only firestore:rules --project pack-all-c1794
```

### 3. 네이버 로그인 설정

#### ① Naver Developer 앱 등록
1. [developers.naver.com](https://developers.naver.com) → 내 애플리케이션 → 등록
2. 사용 API: **네아로 (네이버 아이디로 로그인)** 선택
3. 서비스 URL: `https://banglang-club.vercel.app`
4. Callback URL:
   - `http://localhost:3001/`
   - `https://banglang-club.vercel.app/`
5. 발급된 **Client ID** → `index.html`의 `window.NAVER_CLIENT_ID` 값으로 교체

#### ② Firebase Admin SDK 키 발급
1. Firebase Console → 프로젝트 설정 → **서비스 계정**
2. "새 비공개 키 생성" → JSON 다운로드
3. Vercel 환경변수 등록:

```
FIREBASE_PROJECT_ID    = pack-all-c1794
FIREBASE_CLIENT_EMAIL  = firebase-adminsdk-xxxxx@pack-all-c1794.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY   = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Firestore 컬렉션 구조

```
chatRooms/{roomId}
  - userId, userEmail, userName, userPhotoURL
  - title, lastMessage, lastMessageAt
  - createdAt, answered, userUnread

chatRooms/{roomId}/messages/{msgId}
  - text, senderId, senderType ('user'|'admin')
  - senderName, senderPhoto, createdAt
```

Packo 기존 데이터(`users/`, `shared_lists/`, `feedback/`)와 충돌 없음.
