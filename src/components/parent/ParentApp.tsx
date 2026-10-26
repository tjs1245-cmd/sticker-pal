"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { post } from "@/lib/apiClient";
import ApprovalsTab from "./ApprovalsTab";
import CouponsTab from "./CouponsTab";
import RoutinesTab from "./RoutinesTab";
import SettingsTab from "./SettingsTab";
import { ui } from "./ui";
import { useFamily } from "./useFamily";

type Tab = "approvals" | "routines" | "coupons" | "settings";

export default function ParentApp() {
  const [session, setSession] = useState<"loading" | "out" | "in">("loading");

  useEffect(() => {
    let alive = true;
    post<{ loggedIn: boolean }>("/api/parent", { action: "me" }).then((r) => {
      if (alive) setSession(r.ok && r.loggedIn ? "in" : "out");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (session === "loading") return <div className="grid min-h-dvh place-items-center text-4xl">⭐</div>;
  if (session === "out") return <Login onDone={() => setSession("in")} />;
  return <Dashboard onLoggedOut={() => setSession("out")} />;
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 py-8">
      <h1 className="text-center text-4xl">👨‍👩‍👧 부모 화면</h1>
      {children}
      <Link href="/" className="text-center underline decoration-dotted">
        처음으로
      </Link>
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await post("/api/parent", { action: "login", loginId: id, password: pw });
    setBusy(false);
    if (r.ok) onDone();
    else if (r.error === "too_many") setErr("로그인 실패가 많아요. 잠시 뒤에 다시 시도해 주세요.");
    else if (r.error === "not_configured") setErr("서버에 DATABASE_URL 이 설정되지 않았어요.");
    else setErr("아이디나 비밀번호가 맞지 않아요.");
  }

  return (
    <Shell>
      <form onSubmit={submit} className={`${ui.card} flex flex-col gap-3`}>
        <label className="flex flex-col gap-1 text-lg">
          아이디
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            className={ui.input}
          />
        </label>
        <label className="flex flex-col gap-1 text-lg">
          비밀번호
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            className={ui.input}
          />
        </label>
        {err && <p className="text-rose-500">{err}</p>}
        <button type="submit" disabled={busy || !id || !pw} className={ui.primary}>
          로그인
        </button>
        <p className="text-sm opacity-70">계정은 ADMIN이 만들어 드려요.</p>
      </form>
    </Shell>
  );
}

function Dashboard({ onLoggedOut }: { onLoggedOut: () => void }) {
  const { data, error, refresh } = useFamily(true, onLoggedOut);
  const [tab, setTab] = useState<Tab>("approvals");
  const [kidId, setKidId] = useState<string | null>(null);

  const pendingCount = data?.pending.length ?? 0;
  useEffect(() => {
    document.title = pendingCount > 0 ? `(${pendingCount}) 승인함 · 스티커 친구` : "부모 화면 · 스티커 친구";
  }, [pendingCount]);

  if (!data) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center text-xl">
        {error === "no_profile" ? (
          <div className="flex flex-col items-center gap-3">
            <p>이 계정은 가족에 연결되어 있지 않아요. ADMIN에게 문의해 주세요.</p>
            <button className={ui.ghost} onClick={async () => { await post("/api/parent", { action: "logout" }); onLoggedOut(); }}>
              로그아웃
            </button>
          </div>
        ) : error ? (
          "연결이 불안정해요. 잠시 뒤 다시 시도해 주세요 📶"
        ) : (
          <span className="text-4xl">⭐</span>
        )}
      </div>
    );
  }

  const kid = data.kids.find((k) => k.id === kidId) ?? data.kids[0] ?? null;
  const tabs: [Tab, string][] = [
    ["approvals", pendingCount ? `승인함 (${pendingCount})` : "승인함"],
    ["routines", "루틴"],
    ["coupons", "쿠폰"],
    ["settings", "설정"],
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-5">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl">
          {data.me.role === "mom" ? "👩" : "👨"} {data.familyName}
        </h1>
        {kid && (
          <Link href={`/kid/${kid.view_token}`} className={ui.ghost}>
            아이 화면 보기 →
          </Link>
        )}
      </header>

      {data.kids.length > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="아이 선택">
          {data.kids.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={kid?.id === k.id}
              onClick={() => setKidId(k.id)}
              className={`rounded-full px-4 py-1 text-lg shadow ${kid?.id === k.id ? "bg-violet-500 text-white" : "bg-white"}`}
            >
              {k.avatar} {k.name}
            </button>
          ))}
        </div>
      )}

      <nav className="flex gap-1 rounded-2xl bg-white/80 p-1 shadow" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl px-1 py-2 text-base ${tab === id ? "bg-violet-500 text-white shadow" : ""}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "approvals" && <ApprovalsTab data={data} kid={kid} refresh={refresh} />}
      {tab === "routines" && kid && <RoutinesTab data={data} kid={kid} refresh={refresh} />}
      {tab === "coupons" && kid && <CouponsTab data={data} kid={kid} refresh={refresh} />}
      {tab === "settings" && <SettingsTab data={data} refresh={refresh} onLoggedOut={onLoggedOut} />}
      {tab !== "approvals" && tab !== "settings" && !kid && <p className="text-center opacity-70">아이가 없어요.</p>}
    </main>
  );
}

