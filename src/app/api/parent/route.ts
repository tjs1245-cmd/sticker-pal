import { NextResponse, type NextRequest } from "next/server";
import { makeLimiter } from "@/lib/adminAuth";
import { errorCode, query, queryOne, tx } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { PARENT_COOKIE, PARENT_SESSION_SECONDS, createParentToken, currentParent, type ParentProfile } from "@/lib/parentSession";

// 부모 로그인: 같은 IP+아이디로 5번 틀리면 15분 차단
const loginLimiter = makeLimiter(5, 15 * 60 * 1000);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

type Body = Record<string, unknown>;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail("invalid_input");
  }
  const action = str(body.action);

  try {
    if (action === "login") return await login(req, body);
    if (action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(PARENT_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
      return res;
    }

    const me = await currentParent(req);
    if (action === "me") return NextResponse.json({ ok: true, loggedIn: Boolean(me) });
    if (!me) return fail("unauthorized", 401);

    switch (action) {
      case "data":
        return await familyData(me);
      case "approve":
        return await dbCall("select public.approve_submission($1, $2)", [me.id, body.submissionId], isUuid(body.submissionId));
      case "reject":
        return await dbCall(
          "select public.reject_submission($1, $2, $3)",
          [me.id, body.submissionId, str(body.note, 40)],
          isUuid(body.submissionId),
        );
      case "bonus":
        return await dbCall(
          "select public.give_bonus_sticker($1, $2, $3)",
          [me.id, body.kidId, str(body.note, 40)],
          isUuid(body.kidId),
        );
      case "addKid":
        return await dbCall("select public.add_kid($1, $2)", [me.id, str(body.name, 20)], str(body.name, 20).length > 0);
      case "addRoutine":
        return await addRoutine(me, body);
      case "updateRoutine":
        return await updateRoutine(me, body);
      case "removeSticker":
        return await dbCall(
          "select public.remove_sticker($1, $2, $3, $4)",
          [me.id, body.stickerId, body.mode, str(body.reason, 40)],
          isUuid(body.stickerId) && (body.mode === "redo" || body.mode === "remove"),
        );
      case "addQuiz":
        return await saveQuiz(me, body, null);
      case "updateQuiz":
        return await saveQuiz(me, body, isUuid(body.id) ? body.id : "invalid");
      case "reorderRoutines":
        return await reorderRoutines(me, body);
      case "useCoupon":
        return await redeemCoupon(me, body);
      case "updateKid":
        return await updateKid(me, body);
      case "changePassword":
        return await changePassword(me, body);
      default:
        return fail("invalid_input");
    }
  } catch (e) {
    const err = errorCode(e);
    if (err === "server") console.error("[parent]", action, e);
    return fail(err, err === "server" || err === "not_configured" ? 500 : 409);
  }
}

async function dbCall(sql: string, params: unknown[], valid: boolean) {
  if (!valid) return fail("invalid_input");
  await query(sql, params);
  return NextResponse.json({ ok: true });
}

async function login(req: NextRequest, body: Body) {
  const loginId = str(body.loginId, 60).toLowerCase().split("@")[0]; // 이메일 모양으로 입력해도 아이디만 씁니다
  const password = typeof body.password === "string" ? body.password : "";
  const key = `${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}|${loginId}`;
  const wait = loginLimiter.blockedMinutes(key);
  if (wait > 0) return NextResponse.json({ ok: false, error: "too_many", minutes: wait }, { status: 429 });

  const row = loginId
    ? await queryOne<{ id: string; password_hash: string }>("select id, password_hash from profiles where login_id = $1", [loginId])
    : null;
  // 계정이 없어도 같은 시간이 걸리도록 항상 해시 검증을 합니다.
  const ok = await verifyPassword(password, row?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!row || !ok) {
    loginLimiter.fail(key);
    return fail("bad_login", 401);
  }
  loginLimiter.success(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARENT_COOKIE, createParentToken(row.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PARENT_SESSION_SECONDS,
  });
  return res;
}

async function familyData(me: ParentProfile) {
  const [fam, kids, routines, pending, coupons, quizzes, stickers] = await Promise.all([
    queryOne<{ name: string; today: string }>(
      "select name, to_char((now() at time zone timezone)::date, 'YYYY-MM-DD') as today from families where id = $1",
      [me.family_id],
    ),
    query("select id, name, avatar, view_token from kids where family_id = $1 order by created_at", [me.family_id]),
    query(
      `select r.id, r.kid_id, r.name, r.emoji, r.sort_no, r.active from routines r
         join kids k on k.id = r.kid_id where k.family_id = $1 and r.active order by r.sort_no, r.created_at`,
      [me.family_id],
    ),
    query(
      `select s.id, s.kid_id, to_char(s.date, 'YYYY-MM-DD') as date, s.created_at from submissions s
         join kids k on k.id = s.kid_id where k.family_id = $1 and s.status = 'pending' order by s.date, s.created_at`,
      [me.family_id],
    ),
    query(
      `select c.id, c.kid_id, c.title, c.used_at, c.created_at from coupons c
         join kids k on k.id = c.kid_id where k.family_id = $1 order by c.created_at desc`,
      [me.family_id],
    ),
    query(
      `select z.id, z.kid_id, z.question, z.kind, z.options, z.answer from quizzes z
         join kids k on k.id = z.kid_id where k.family_id = $1 and z.active order by z.sort_no, z.created_at`,
      [me.family_id],
    ),
    // 지금 채우는 판의 스티커만(여기서만 뺄 수 있음)
    query(
      `select st.id, st.kid_id, st.slot_no, st.kind, to_char(st.date, 'YYYY-MM-DD') as date, st.awarded_role, st.note
         from stickers st join kids k on k.id = st.kid_id
        where k.family_id = $1 and st.board_id = k.current_board_id order by st.slot_no`,
      [me.family_id],
    ),
  ]);
  return NextResponse.json({
    ok: true,
    me: { id: me.id, role: me.role, login_id: me.login_id, family_id: me.family_id },
    familyName: fam?.name ?? "",
    today: fam?.today ?? "",
    kids,
    routines,
    pending,
    coupons,
    quizzes,
    stickers,
  });
}

/** 문제 만들기(quizId=null) / 고치기 / 삭제(active:false). 검증은 여기서, 채점 규칙은 DB 함수에서 합니다. */
async function saveQuiz(me: ParentProfile, body: Body, quizId: string | null) {
  if (quizId === "invalid") return fail("invalid_input");

  if (quizId && body.active === false) {
    const rows = await query(
      `update quizzes z set active = false from kids k
         where z.id = $1 and k.id = z.kid_id and k.family_id = $2 returning z.id`,
      [quizId, me.family_id],
    );
    return rows.length ? NextResponse.json({ ok: true }) : fail("forbidden", 403);
  }

  const question = str(body.question, 200);
  const kind = body.kind === "choice" || body.kind === "short" ? body.kind : null;
  if (!question || !kind) return fail("invalid_input");

  let options: string[] | null = null;
  let answer = "";
  if (kind === "choice") {
    options = Array.isArray(body.options) ? body.options.map((o) => str(o, 40)).filter(Boolean) : [];
    const idx = Number(body.correctIndex);
    if (options.length < 2 || options.length > 4 || !Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return fail("invalid_input");
    }
    answer = String(idx);
  } else {
    // 쉼표나 | 로 구분한 정답들(예: "토끼, rabbit")
    const list = str(body.answers, 100)
      .split(/[|,]/)
      .map((a) => a.trim())
      .filter(Boolean);
    answer = list.join("|");
    if (!answer) return fail("invalid_input");
  }

  if (quizId) {
    const rows = await query(
      `update quizzes z set question = $3, kind = $4, options = $5, answer = $6
         from kids k where z.id = $1 and k.id = z.kid_id and k.family_id = $2 returning z.id`,
      [quizId, me.family_id, question, kind, options, answer],
    );
    return rows.length ? NextResponse.json({ ok: true }) : fail("forbidden", 403);
  }

  if (!(await kidInFamily(me, body.kidId))) return fail("invalid_input");
  await query(
    `insert into quizzes (kid_id, question, kind, options, answer, sort_no)
       values ($1, $2, $3, $4, $5, (select coalesce(max(sort_no), 0) + 1 from quizzes where kid_id = $1))`,
    [body.kidId, question, kind, options, answer],
  );
  return NextResponse.json({ ok: true });
}

async function kidInFamily(me: ParentProfile, kidId: unknown): Promise<boolean> {
  if (!isUuid(kidId)) return false;
  return Boolean(await queryOne("select 1 from kids where id = $1 and family_id = $2", [kidId, me.family_id]));
}

async function addRoutine(me: ParentProfile, body: Body) {
  const name = str(body.name, 30);
  if (!name || !(await kidInFamily(me, body.kidId))) return fail("invalid_input");
  const emoji = str(body.emoji, 8) || "⭐";
  await query(
    `insert into routines (kid_id, name, emoji, sort_no)
       values ($1, $2, $3, (select coalesce(max(sort_no), 0) + 1 from routines where kid_id = $1))`,
    [body.kidId, name, emoji],
  );
  return NextResponse.json({ ok: true });
}

async function updateRoutine(me: ParentProfile, body: Body) {
  if (!isUuid(body.id)) return fail("invalid_input");
  const name = body.name === undefined ? null : str(body.name, 30);
  const emoji = body.emoji === undefined ? null : str(body.emoji, 8) || "⭐";
  const active = typeof body.active === "boolean" ? body.active : null;
  if (name === "") return fail("invalid_input");
  const rows = await query(
    `update routines r set name = coalesce($2, r.name), emoji = coalesce($3, r.emoji), active = coalesce($4, r.active)
       from kids k where r.id = $1 and k.id = r.kid_id and k.family_id = $5 returning r.id`,
    [body.id, name, emoji, active, me.family_id],
  );
  return rows.length ? NextResponse.json({ ok: true }) : fail("forbidden", 403);
}

async function reorderRoutines(me: ParentProfile, body: Body) {
  const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid) : [];
  if (!(await kidInFamily(me, body.kidId)) || ids.length === 0) return fail("invalid_input");
  await tx(async (c) => {
    for (let i = 0; i < ids.length; i++) {
      await c.query("update routines set sort_no = $1 where id = $2 and kid_id = $3", [i + 1, ids[i], body.kidId]);
    }
  });
  return NextResponse.json({ ok: true });
}

async function redeemCoupon(me: ParentProfile, body: Body) {
  if (!isUuid(body.id)) return fail("invalid_input");
  const rows = await query(
    `update coupons c set used_at = now() from kids k
       where c.id = $1 and k.id = c.kid_id and k.family_id = $2 and c.used_at is null returning c.id`,
    [body.id, me.family_id],
  );
  return rows.length ? NextResponse.json({ ok: true }) : fail("not_found", 404);
}

async function updateKid(me: ParentProfile, body: Body) {
  const name = str(body.name, 20);
  const avatar = str(body.avatar, 8);
  const code = str(body.code, 6).toUpperCase();
  if (!(await kidInFamily(me, body.id)) || !name || !avatar || !CODE_RE.test(code)) return fail("invalid_input");
  await query("update kids set name = $1, avatar = $2, view_token = $3 where id = $4", [name, avatar, code, body.id]);
  return NextResponse.json({ ok: true });
}

async function changePassword(me: ParentProfile, body: Body) {
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  if (next.length < 6) return fail("weak_password");
  const row = await queryOne<{ password_hash: string }>("select password_hash from profiles where id = $1", [me.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) return fail("wrong_password", 403);
  await query("update profiles set password_hash = $1 where id = $2", [await hashPassword(next), me.id]);
  return NextResponse.json({ ok: true });
}

