import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_SECONDS,
  adminLimiter,
  adminPassword,
  createSessionToken,
  isDefaultPassword,
  safeEqual,
  verifySessionToken,
} from "@/lib/adminAuth";
import { dbConfigured, errorCode, query, queryOne, tx } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";

const ID_RE = /^[a-z0-9]{2,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Record<string, unknown>;

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function dbMessage(e: unknown): string {
  const code = errorCode(e);
  if (code === "family_limit_reached") return "가족은 최대 5개까지 만들 수 있어요.";
  if (code === "kid_limit_reached") return "아이는 가족당 최대 2명이에요.";
  if (code === "duplicate") return "이미 사용 중인 아이디예요.";
  if (code === "not_configured") return "DATABASE_URL 환경변수가 설정되지 않았어요.";
  console.error("[admin]", e);
  return "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail("잘못된 요청이에요.");
  }
  const action = str(body.action);
  const authed = verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);

  if (action === "login") {
    const ip = clientIp(req);
    const wait = adminLimiter.blockedMinutes(ip);
    if (wait > 0) return fail(`로그인 실패가 많아요. ${wait}분 뒤에 다시 시도해 주세요.`, 429);
    const password = typeof body.password === "string" ? body.password : "";
    if (!safeEqual(password, adminPassword())) {
      adminLimiter.fail(ip);
      return fail("비밀번호가 맞지 않아요.", 401);
    }
    adminLimiter.success(ip);
    const res = NextResponse.json({ ok: true, defaultPassword: isDefaultPassword() });
    res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return res;
  }

  if (action === "me") {
    return NextResponse.json({ ok: true, loggedIn: authed, defaultPassword: authed ? isDefaultPassword() : false });
  }

  if (!authed) return fail("ADMIN 로그인이 필요해요.", 401);
  if (!dbConfigured()) return fail("DATABASE_URL 환경변수가 설정되지 않았어요.", 500);

  try {
    switch (action) {
      case "list":
        return await listFamilies();
      case "createFamily":
        return await createFamily(body);
      case "deleteFamily":
        return await deleteFamily(body);
      case "renameFamily":
        return await renameFamily(body);
      case "resetPassword":
        return await resetPassword(body);
      default:
        return fail("알 수 없는 요청이에요.");
    }
  } catch (e) {
    return fail(dbMessage(e), 500);
  }
}

async function listFamilies() {
  type P = { id: string; family_id: string; role: "mom" | "dad"; login_id: string };
  type K = { id: string; family_id: string; name: string; code: string };
  const [fam, prof, kids] = await Promise.all([
    query<{ id: string; name: string; created_at: string }>("select id, name, created_at from families order by created_at"),
    query<P>("select id, family_id, role, login_id from profiles order by role desc"),
    query<K>("select id, family_id, name, view_token as code from kids order by created_at"),
  ]);
  const families = fam.map((f) => ({
    ...f,
    parents: prof.filter((p) => p.family_id === f.id),
    kids: kids.filter((k) => k.family_id === f.id).map((k) => ({ id: k.id, name: k.name, code: k.code })),
  }));
  return NextResponse.json({ ok: true, families, limit: 5 });
}

async function createFamily(body: Body) {
  const familyName = str(body.familyName);
  const kidName = str(body.kidName);
  const people = [
    { role: "mom", id: str(body.momId).toLowerCase(), password: typeof body.momPassword === "string" ? body.momPassword : "" },
    { role: "dad", id: str(body.dadId).toLowerCase(), password: typeof body.dadPassword === "string" ? body.dadPassword : "" },
  ] as const;

  if (!familyName || familyName.length > 40) return fail("가족 이름을 1~40자로 입력해 주세요.");
  if (!kidName || kidName.length > 20) return fail("아이 이름을 1~20자로 입력해 주세요.");
  for (const p of people) {
    if (!ID_RE.test(p.id)) return fail("아이디는 영문 소문자/숫자 2~20자예요.");
    if (p.password.length < 6) return fail("비밀번호는 6자 이상이어야 해요.");
  }
  if (people[0].id === people[1].id) return fail("엄마와 아빠 아이디가 같아요.");

  const hashes = await Promise.all(people.map((p) => hashPassword(p.password)));

  // 한 트랜잭션이라 중간에 실패하면 가족·부모·아이가 모두 취소됩니다(롤백).
  const familyId = await tx(async (c) => {
    const fam = await c.query<{ id: string }>("insert into families (name) values ($1) returning id", [familyName]);
    const id = fam.rows[0].id;
    for (let i = 0; i < people.length; i++) {
      await c.query("insert into profiles (family_id, role, login_id, password_hash) values ($1, $2, $3, $4)", [
        id,
        people[i].role,
        people[i].id,
        hashes[i],
      ]);
    }
    await c.query("select public._create_kid($1, $2)", [id, kidName]);
    return id;
  });
  return NextResponse.json({ ok: true, familyId });
}

async function deleteFamily(body: Body) {
  const id = str(body.id);
  const confirmName = typeof body.confirmName === "string" ? body.confirmName : "";
  if (!UUID_RE.test(id)) return fail("잘못된 요청이에요.");
  const fam = await queryOne<{ name: string }>("select name from families where id = $1", [id]);
  if (!fam) return fail("가족을 찾을 수 없어요.", 404);
  if (confirmName !== fam.name) return fail("가족 이름을 똑같이 입력해야 삭제할 수 있어요.");
  // 부모 계정, 아이, 스티커, 쿠폰 등은 외래키 cascade 로 함께 삭제됩니다.
  await query("delete from families where id = $1", [id]);
  return NextResponse.json({ ok: true });
}

async function renameFamily(body: Body) {
  const id = str(body.id);
  const name = str(body.name);
  if (!UUID_RE.test(id)) return fail("잘못된 요청이에요.");
  if (!name || name.length > 40) return fail("가족 이름을 1~40자로 입력해 주세요.");
  await query("update families set name = $1 where id = $2", [name, id]);
  return NextResponse.json({ ok: true });
}

async function resetPassword(body: Body) {
  const profileId = str(body.profileId);
  const password = typeof body.password === "string" ? body.password : "";
  if (!UUID_RE.test(profileId)) return fail("잘못된 요청이에요.");
  if (password.length < 6) return fail("비밀번호는 6자 이상이어야 해요.");
  const rows = await query("update profiles set password_hash = $1 where id = $2 returning id", [
    await hashPassword(password),
    profileId,
  ]);
  return rows.length ? NextResponse.json({ ok: true }) : fail("부모 계정을 찾을 수 없어요.", 404);
}
