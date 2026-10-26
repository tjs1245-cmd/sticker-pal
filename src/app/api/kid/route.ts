import { NextResponse, type NextRequest } from "next/server";
import { makeLimiter } from "@/lib/adminAuth";
import { errorCode, queryOne } from "@/lib/db";

// 아이 코드 무작위 대입을 늦추기 위한 느슨한 제한: IP 당 20번 틀리면 5분 차단
const codeLimiter = makeLimiter(20, 5 * 60 * 1000);

const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("invalid_input");
  }
  const action = typeof body.action === "string" ? body.action : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!CODE_RE.test(code)) return fail("invalid_code", 404);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (codeLimiter.blockedMinutes(ip) > 0) return fail("too_many", 429);

  try {
    let row: { v: unknown } | null = null;
    if (action === "view") {
      row = await queryOne("select public.kid_view($1) as v", [code]);
    } else if (action === "toggle") {
      const routineId = typeof body.routineId === "string" ? body.routineId : "";
      if (!UUID_RE.test(routineId) || typeof body.done !== "boolean") return fail("invalid_input");
      row = await queryOne("select public.kid_toggle($1, $2, $3) as v", [code, routineId, body.done]);
    } else if (action === "pickTheme") {
      const themeId = typeof body.themeId === "string" ? body.themeId : "";
      row = await queryOne("select public.kid_pick_theme($1, $2) as v", [code, themeId]);
    } else {
      return fail("invalid_input");
    }
    return NextResponse.json({ ok: true, view: row?.v ?? null });
  } catch (e) {
    const err = errorCode(e);
    if (err === "invalid_code") {
      codeLimiter.fail(ip);
      return fail(err, 404);
    }
    if (err === "server") console.error("[kid]", action, e);
    return fail(err, err === "not_configured" || err === "server" ? 500 : 409);
  }
}
