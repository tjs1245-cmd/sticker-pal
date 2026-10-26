// db/schema.sql 을 DATABASE_URL 의 DB에 실행합니다. (재실행해도 안전)
// 사용: npm run db:init   (.env.local 의 DATABASE_URL 을 읽습니다)
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다. .env.local 에 값을 넣었는지 확인해 주세요.");
  process.exit(1);
}

const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query("select count(*)::int as n from public.themes");
  console.log(`스키마 적용 완료 (테마 ${rows[0].n}개).`);
} catch (e) {
  console.error("스키마 적용 실패:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
