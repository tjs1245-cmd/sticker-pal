import "server-only";
import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminPassword, safeEqual } from "./adminAuth";
import { queryOne } from "./db";

export const PARENT_COOKIE = "sp_parent";
export const PARENT_SESSION_SECONDS = 30 * 24 * 60 * 60;

export type ParentProfile = {
  id: string;
  family_id: string;
  role: "mom" | "dad";
  login_id: string;
};

// AUTH_SECRET 이 있으면 그것으로, 없으면 ADMIN_PASSWORD 와 DATABASE_URL 에서 만든 값으로 서명합니다.
function secret(): string {
  return process.env.AUTH_SECRET || `${adminPassword()}|${process.env.DATABASE_URL ?? ""}`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`parent:${payload}`).digest("base64url");
}

export function createParentToken(profileId: string): string {
  const exp = Math.floor(Date.now() / 1000) + PARENT_SESSION_SECONDS;
  const payload = `${profileId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** 쿠키가 유효하고 계정이 아직 존재하면 그 부모를, 아니면 null */
export async function currentParent(req: NextRequest): Promise<ParentProfile | null> {
  const token = req.cookies.get(PARENT_COOKIE)?.value;
  if (!token) return null;
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || !/^\d+$/.test(exp)) return null;
  if (!safeEqual(sig, sign(`${id}.${exp}`))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  try {
    return await queryOne<ParentProfile>("select id, family_id, role, login_id from profiles where id = $1", [id]);
  } catch {
    return null;
  }
}
