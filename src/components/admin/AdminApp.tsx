"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Family = {
  id: string;
  name: string;
  created_at: string;
  parents: { id: string; role: "mom" | "dad"; login_id: string }[];
  kids: { id: string; name: string; code: string }[];
};

type ApiResult = { ok: boolean; error?: string; [k: string]: unknown };

async function api(body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResult;
  } catch {
    return { ok: false, error: "서버에 연결하지 못했어요." };
  }
}

const card = "rounded-3xl bg-white/90 p-5 shadow-lg";
const input = "w-full rounded-xl border-2 border-violet-200 bg-white px-3 py-2 text-lg outline-none focus:border-violet-400";
const primary = "rounded-xl bg-violet-500 px-4 py-2 text-lg text-white shadow disabled:opacity-40 active:scale-95";
const ghost = "rounded-xl bg-white px-4 py-2 text-lg shadow border border-violet-200 active:scale-95";

export default function AdminApp() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [defaultPw, setDefaultPw] = useState(false);

  useEffect(() => {
    let alive = true;
    api({ action: "me" }).then((r) => {
      if (!alive) return;
      setState(r.loggedIn ? "in" : "out");
      setDefaultPw(Boolean(r.defaultPassword));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") return <div className="grid min-h-dvh place-items-center text-4xl">⭐</div>;
  if (state === "out")
    return (
      <Login
        onDone={(d) => {
          setDefaultPw(d);
          setState("in");
        }}
      />
    );
  return (
    <Dashboard
      defaultPw={defaultPw}
      onLogout={async () => {
        await api({ action: "logout" });
        setState("out");
      }}
    />
  );
}

function Login({ onDone }: { onDone: (defaultPassword: boolean) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await api({ action: "login", password: pw });
    setBusy(false);
    if (r.ok) onDone(Boolean(r.defaultPassword));
    else setErr(r.error ?? "로그인하지 못했어요.");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-5">
      <h1 className="text-center text-4xl">🔧 ADMIN</h1>
      <form onSubmit={submit} className={`${card} flex flex-col gap-3`}>
        <label htmlFor="admin-pw" className="text-xl">
          ADMIN 비밀번호
        </label>
        <input
          id="admin-pw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          className={input}
        />
        {err && <p className="text-rose-500">{err}</p>}
        <button type="submit" disabled={busy || !pw} className={primary}>
          로그인
        </button>
      </form>
      <Link href="/" className="text-center underline decoration-dotted">
        처음으로
      </Link>
    </main>
  );
}

function Dashboard({ defaultPw, onLogout }: { defaultPw: boolean; onLogout: () => void }) {
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [limit, setLimit] = useState(5);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const r = await api({ action: "list" });
    if (r.ok) {
      setFamilies(r.families as Family[]);
      setLimit(Number(r.limit) || 5);
      setErr("");
    } else {
      setErr(r.error ?? "불러오지 못했어요.");
      setFamilies([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const count = families?.length ?? 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl">🔧 ADMIN</h1>
        <div className="flex gap-2">
          <Link href="/" className={ghost}>
            처음으로
          </Link>
          <button type="button" onClick={onLogout} className={ghost}>
            로그아웃
          </button>
        </div>
      </header>

      {defaultPw && (
        <div role="alert" className="rounded-2xl bg-rose-100 px-4 py-3 text-lg text-rose-700 shadow">
          ⚠️ ADMIN 비밀번호가 기본값(1234)이에요. 인터넷에 배포하기 전에 환경변수 <b>ADMIN_PASSWORD</b>를 꼭 바꿔 주세요.
        </div>
      )}
      {err && <div className="rounded-2xl bg-yellow-100 px-4 py-3 text-lg shadow">{err}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl">
          가족 {count} / {limit}
        </h2>
        <button type="button" onClick={() => setCreating((c) => !c)} disabled={count >= limit} className={primary}>
          {creating ? "닫기" : "＋ 가족 추가"}
        </button>
      </div>

      {creating && (
        <CreateFamily
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {families === null && <p>불러오는 중…</p>}
      {families?.map((f) => <FamilyCard key={f.id} family={f} onChanged={load} />)}
      {families && families.length === 0 && !err && <p className="text-center opacity-70">아직 가족이 없어요.</p>}
    </main>
  );
}

function CreateFamily({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState({ familyName: "", momId: "", momPassword: "", dadId: "", dadPassword: "", kidName: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await api({ action: "createFamily", ...f });
    setBusy(false);
    if (r.ok) onCreated();
    else setErr(r.error ?? "만들지 못했어요.");
  }

  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-3`}>
      <label className="flex flex-col gap-1">
        가족 이름
        <input value={f.familyName} onChange={set("familyName")} maxLength={40} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          👩 엄마 아이디
          <input value={f.momId} onChange={set("momId")} maxLength={20} autoCapitalize="none" autoComplete="off" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          엄마 비밀번호
          <input type="password" value={f.momPassword} onChange={set("momPassword")} autoComplete="new-password" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          👨 아빠 아이디
          <input value={f.dadId} onChange={set("dadId")} maxLength={20} autoCapitalize="none" autoComplete="off" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          아빠 비밀번호
          <input type="password" value={f.dadPassword} onChange={set("dadPassword")} autoComplete="new-password" className={input} />
        </label>
      </div>
      <p className="text-sm opacity-70">아이디: 영문 소문자/숫자 2~20자 · 비밀번호: 6자 이상</p>
      <label className="flex flex-col gap-1">
        아이 이름 (기본 루틴 3개가 만들어져요)
        <input value={f.kidName} onChange={set("kidName")} maxLength={20} className={input} />
      </label>
      {err && <p className="text-rose-500">{err}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "만드는 중…" : "가족 만들기"}
      </button>
    </form>
  );
}

function FamilyCard({ family, onChanged }: { family: Family; onChanged: () => void }) {
  const [name, setName] = useState(family.name);
  const [msg, setMsg] = useState("");
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function run(body: Record<string, unknown>, okMsg: string) {
    const r = await api(body);
    setMsg(r.ok ? okMsg : (r.error ?? "실패했어요."));
    return r.ok;
  }

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="가족 이름" className={input} />
        <button
          type="button"
          disabled={!name.trim() || name === family.name}
          onClick={async () => {
            if (await run({ action: "renameFamily", id: family.id, name }, "이름을 바꿨어요.")) onChanged();
          }}
          className={primary}
        >
          저장
        </button>
      </div>

      <ul className="text-lg">
        {family.parents.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 py-1">
            <span>
              {p.role === "mom" ? "👩 엄마" : "👨 아빠"} · {p.login_id}
            </span>
            <button type="button" onClick={() => { setPwFor(pwFor === p.id ? null : p.id); setPw(""); }} className={ghost}>
              비밀번호 재설정
            </button>
          </li>
        ))}
      </ul>

      {pwFor && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ action: "resetPassword", profileId: pwFor, password: pw }, "비밀번호를 바꿨어요.")) {
              setPwFor(null);
              setPw("");
            }
          }}
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            autoComplete="new-password"
            className={input}
          />
          <button type="submit" disabled={pw.length < 6} className={primary}>
            변경
          </button>
        </form>
      )}

      <p className="text-base opacity-80">
        🧒 {family.kids.map((k) => `${k.name}(${k.code})`).join(", ") || "아이 없음"}
      </p>

      {msg && <p className="rounded-xl bg-violet-100 px-3 py-2">{msg}</p>}

      {!del ? (
        <button type="button" onClick={() => setDel(true)} className="self-start text-rose-500 underline decoration-dotted">
          가족 삭제…
        </button>
      ) : (
        <form
          className="flex flex-col gap-2 rounded-2xl bg-rose-50 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ action: "deleteFamily", id: family.id, confirmName: confirm }, "삭제했어요.")) onChanged();
          }}
        >
          <p className="text-rose-700">
            삭제하면 아이 기록과 부모 계정이 모두 사라져요. 확인하려면 가족 이름 <b>{family.name}</b>을 똑같이 입력하세요.
          </p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} aria-label="가족 이름 확인" />
          <div className="flex gap-2">
            <button type="submit" disabled={confirm !== family.name} className="rounded-xl bg-rose-500 px-4 py-2 text-lg text-white disabled:opacity-40">
              영구 삭제
            </button>
            <button type="button" onClick={() => { setDel(false); setConfirm(""); }} className={ghost}>
              취소
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
