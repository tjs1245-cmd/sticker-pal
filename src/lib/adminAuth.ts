import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "sp_admin";
export const SESSION_SECONDS = 8 * 60 * 60;

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "1234";
}

export function isDefaultPassword(): boolean {
  return adminPassword() === "1234";
}

/** 두 문자열을 해시한 뒤 timingSafeEqual 로 비교(길이 차이로 새지 않게) */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ADMIN 비밀번호가 서명 키에 섞여 있어서, 비밀번호를 바꾸면 기존 세션은 모두 무효가 됩니다.
function signingKey(): Buffer {
  return createHmac("sha256", "sticker-pal-admin-session-v1").update(adminPassword()).digest();
}

function sign(exp: string): string {
  return createHmac("sha256", signingKey()).update(exp).digest("base64url");
}

export function createSessionToken(): string {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}

/** 실패 횟수 제한(서버 인스턴스 메모리 기준). 키별로 maxFails 회 실패하면 blockMs 동안 차단 */
export function makeLimiter(maxFails: number, blockMs: number) {
  const fails = new Map<string, { count: number; blockedUntil: number }>();
  return {
    /** 차단 중이면 남은 분(올림), 아니면 0 */
    blockedMinutes(key: string): number {
      const f = fails.get(key);
      if (!f) return 0;
      if (f.blockedUntil > Date.now()) return Math.ceil((f.blockedUntil - Date.now()) / 60000);
      if (f.blockedUntil) fails.delete(key);
      return 0;
    },
    fail(key: string) {
      const f = fails.get(key) ?? { count: 0, blockedUntil: 0 };
      f.count += 1;
      if (f.count >= maxFails) {
        f.blockedUntil = Date.now() + blockMs;
        f.count = 0;
      }
      fails.set(key, f);
    },
    success(key: string) {
      fails.delete(key);
    },
  };
}

export const adminLimiter = makeLimiter(5, 15 * 60 * 1000);
