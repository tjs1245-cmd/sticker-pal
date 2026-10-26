# 스티커 친구

아이가 루틴을 체크하면 부모(엄마/아빠)가 승인해 스티커 1개를 주고, 30개를 모으면 장난감 쿠폰이 생기는 모바일 우선 웹 서비스입니다. 기획은 [SPEC.md](SPEC.md)를 보세요.

스택: Next.js(App Router) · TypeScript · Tailwind · Framer Motion · **Postgres(Neon)** · Vercel

## 구조

- 브라우저는 DB에 직접 접속하지 않습니다. 서버(API 라우트: `/api/kid`, `/api/parent`, `/api/admin`)만 `DATABASE_URL`로 접속합니다.
- 모든 판정(승인, 스티커 발급, 쿠폰, 날짜 계산, 한도)은 DB 함수([db/schema.sql](db/schema.sql))에서 합니다.
- 아이: 6자 코드만 있으면 되고, 코드로는 화면 조회·루틴 토글·테마 선택만 가능합니다.
- 부모: 아이디+비밀번호(scrypt 해시) 로그인 → httpOnly·sameSite=strict 서명 쿠키. 모든 부모 API는 쿠키의 부모 가족 데이터만 다룹니다.
- ADMIN: 환경변수 비밀번호 로그인 → 별도 서명 쿠키. 계정은 ADMIN 화면에서만 만들어집니다(가입 화면 없음).

## 업데이트할 때 (DB가 이미 있는 경우)

`db/schema.sql`이 바뀐 버전(예: 오늘의 문제 추가)을 받았다면, **코드를 배포하기 전에** 스키마를 한 번 더 적용하세요. 재실행해도 기존 데이터는 그대로이고 새 테이블·함수만 추가됩니다.

```bash
npm run db:init
```

## 로컬 실행

```bash
npm install
npm run dev
```

PowerShell 실행 정책 오류가 나면 `npm.cmd`, `npx.cmd`로 실행하세요.
http://localhost:3000 → "데모로 먼저 체험하기"는 DB 없이도 동작합니다.

## Neon 연결 순서 (직접 하는 단계)

1. Vercel 프로젝트에서 **Storage → Create Database → Neon**(Free)을 만들어 프로젝트에 연결하면 `DATABASE_URL` 등이 환경변수로 자동 추가됩니다. (Neon 사이트에서 직접 만들어도 됩니다.)
2. 로컬용으로 `.env.example`을 `.env.local`로 복사하고 `DATABASE_URL`(Neon의 **pooled** Connection string), `ADMIN_PASSWORD`를 직접 입력합니다. Vercel CLI가 있다면 `vercel env pull .env.local`로 받을 수도 있어요.
3. 스키마 적용: `npm run db:init` (여러 번 실행해도 안전합니다). Neon 콘솔 SQL Editor에 `db/schema.sql` 전체를 붙여넣어도 됩니다.
4. `npm run dev` → `/admin` 로그인 → 가족 추가 → `/parent` 부모 로그인 → 설정에서 아이 코드·QR 확인.

## 배포 (Vercel)

1. GitHub public 저장소 `sticker-pal`에 푸시합니다.
2. Vercel → Add New → Project → 저장소 Import. Neon 연결(Storage)을 같은 프로젝트에 붙이고, 환경변수 `ADMIN_PASSWORD`(기본값 1234 금지), 선택으로 `AUTH_SECRET`(길고 무작위인 값)을 입력 → Deploy.
3. 배포된 주소의 `/admin`에서 가족을 만듭니다. (DB 스키마는 처음 한 번 `npm run db:init`로 Neon에 적용해야 합니다.)

## 보안 메모

- `DATABASE_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET`은 서버 환경변수입니다. `NEXT_PUBLIC_`을 붙이지 말고 채팅/깃에 올리지 마세요.
- 가족 5개, 가족당 아이 2명, 가족당 엄마·아빠 1명씩 한도는 DB 트리거/유니크 인덱스로 강제합니다(동시 요청 방어용 advisory lock 포함).
- 가족 간 분리는 API가 부모의 `family_id`로 모든 쿼리를 제한하고, 승인·보너스 같은 DB 함수도 같은 가족인지 다시 확인합니다.
- 로그인 실패 제한(ADMIN·부모 5회/15분, 아이 코드 20회/5분)은 서버 인스턴스 메모리 기준이라 서버리스에서는 인스턴스가 바뀌면 초기화될 수 있어요. 강한 비밀번호를 쓰세요.
