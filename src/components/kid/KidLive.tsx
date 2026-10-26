"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { post } from "@/lib/apiClient";
import KidScreen from "./KidScreen";
import type { Celebration, KidView } from "./types";

const POLL_MS = 5000;

function seenKey(code: string) {
  return `sticker-pal:seen:${code}`;
}
function readSeen(code: string): string | null {
  try {
    return localStorage.getItem(seenKey(code));
  } catch {
    return null;
  }
}
function writeSeen(code: string, id: string) {
  try {
    localStorage.setItem(seenKey(code), id);
  } catch {
    /* 저장이 막혀 있어도 괜찮아요 */
  }
}

/** 실제 데이터로 움직이는 아이 화면. 5초마다 서버에서 다시 읽어 부모 승인을 반영합니다. */
export default function KidLive({ code }: { code: string }) {
  const token = code.toUpperCase();
  const [view, setView] = useState<KidView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const prevCoupons = useRef<number | null>(null);
  const seq = useRef(0);
  const busy = useRef(false);

  const apply = useCallback(
    (next: KidView) => {
      const last = next.lastSticker;
      const seen = readSeen(token);
      if (!last && seen === null) writeSeen(token, "0"); // 첫 방문 표시(이후 첫 스티커는 연출)
      if (last && last.id !== seen) {
        // 처음 열었을 때(seen 없음)는 연출 없이 현재 상태만 기록합니다.
        if (seen !== null) {
          const couponUp = prevCoupons.current !== null && next.coupons.length > prevCoupons.current;
          seq.current += 1;
          setCelebration({
            id: seq.current,
            type: couponUp ? "coupon" : last.kind === "bonus" ? "bonus" : "sticker",
            role: last.role ?? "mom",
            note: last.note,
            slot: last.slot,
            bonus: last.kind === "bonus",
          });
        }
        writeSeen(token, last.id);
      }
      prevCoupons.current = next.coupons.length;
      setView(next);
      setError(null);
    },
    [token],
  );

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await post<{ view: KidView }>("/api/kid", { action: "view", code: token });
      if (r.ok) apply(r.view);
      else setError(r.error === "invalid_code" ? "invalid" : r.error === "not_configured" ? "config" : "network");
    } finally {
      busy.current = false;
    }
  }, [apply, token]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const act = useCallback(
    async (action: string, args: Record<string, unknown>) => {
      const r = await post<{ view: KidView }>("/api/kid", { action, code: token, ...args });
      if (r.ok) apply(r.view);
      else await load(); // 잠금/만료 등으로 거절되면 서버 상태로 되돌립니다.
    },
    [apply, load, token],
  );

  const onToggle = useCallback(
    (id: string) => {
      const cur = view?.routines.find((r) => r.id === id);
      if (!cur) return;
      setView((v) =>
        v ? { ...v, routines: v.routines.map((r) => (r.id === id ? { ...r, done: !r.done } : r)) } : v,
      );
      act("toggle", { routineId: id, done: !cur.done });
    },
    [act, view],
  );

  const onPickTheme = useCallback((themeId: string) => act("pickTheme", { themeId }), [act]);

  if (error === "config") {
    return (
      <Notice emoji="🔌" title="아직 연결되지 않았어요">
        데이터베이스(DATABASE_URL)가 설정되지 않았어요. 지금은 데모로 체험해 볼 수 있어요.
      </Notice>
    );
  }
  if (error === "invalid") {
    return (
      <Notice emoji="🔍" title="코드를 찾을 수 없어요">
        코드 <b>{token}</b>가 맞는지 부모님과 다시 확인해 보세요.
      </Notice>
    );
  }
  if (!view) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center text-3xl">
        {error === "network" ? "연결이 불안정해요. 잠시만 기다려 줘요 📶" : "⭐"}
      </div>
    );
  }

  return (
    <KidScreen
      view={view}
      onToggle={onToggle}
      onPickTheme={onPickTheme}
      celebration={celebration}
      onCelebrationDone={() => setCelebration(null)}
      overlay={
        <div className="mb-3 flex justify-between">
          <Link href="/" className="rounded-full bg-white/80 px-3 py-1 text-base shadow">
            ← 처음으로
          </Link>
          {error === "network" && <span className="rounded-full bg-yellow-200 px-3 py-1 text-base shadow">📶 다시 연결 중…</span>}
        </div>
      }
    />
  );
}

function Notice({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-7xl">{emoji}</div>
      <h1 className="text-3xl">{title}</h1>
      <p className="text-lg opacity-80">{children}</p>
      <div className="flex gap-3">
        <Link href="/" className="rounded-full bg-white px-5 py-2 text-lg shadow">
          처음으로
        </Link>
        <Link href="/kid/demo" className="rounded-full bg-pink-400 px-5 py-2 text-lg text-white shadow">
          데모 보기
        </Link>
      </div>
    </main>
  );
}

