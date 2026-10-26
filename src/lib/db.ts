import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __stickerPool?: Pool };

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function pool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("not_configured");
  // 서버리스에서는 인스턴스마다 풀이 생기므로 작게 유지합니다.
  g.__stickerPool ??= new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX) || 3,
    idleTimeoutMillis: 10_000,
  });
  return g.__stickerPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** DB 함수가 raise exception 한 코드(예: no_board)를 꺼냅니다. 알 수 없으면 "server". */
export function errorCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "not_configured") return "not_configured";
  const known = [
    "invalid_code",
    "locked",
    "pick_theme_first",
    "invalid_routine",
    "board_in_progress",
    "invalid_theme",
    "no_board",
    "board_full",
    "not_pending",
    "not_found",
    "forbidden",
    "not_parent",
    "kid_limit_reached",
    "family_limit_reached",
    "invalid_name",
    "invalid_quiz",
    "invalid_answer",
  ];
  for (const k of known) if (msg.includes(k)) return k;
  const code = (e as { code?: string })?.code;
  if (code === "23505") return "duplicate";
  if (code === "23514" || code === "22P02") return "invalid_input";
  return "server";
}
