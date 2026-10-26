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
      // seen: 지금까지 본 가장 최근 스티커의 받은 시각(ISO). "0"=첫 방문(스티커 없음), null=처음 연 기기.
      // 예전 버전은 스티커 id 를 저장했으므로 그 형식도 받아 줍니다.
      const seen = readSeen(token);
      if (!last && seen === null) writeSeen(token, "0");
      if (last) {
        const stamp = last.createdAt ?? last.id;
        const legacy = seen !== null && seen !== "0" && !/^\d{4}-\d{2}-\d{2}T/.test(seen);
        // 스티커를 '뺀' 경우 직전 스티커가 lastSticker 가 되는데, 그건 본 것보다 오래되어 새것이 아닙니다.
        const isNew =
          seen === null ? false : seen === "0" ? true : legacy ? last.id !== seen : Date.parse(stamp) > Date.parse(seen);
        if (seen !== null && isNew) {
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
        // 더 최근 것으로만 갱신(뒤로 가지 않음)
        if (seen === null || isNew || legacy) writeSeen(token, stamp);
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

  const onAnswer = useCallback(
    async (quizId: string, answer: string): Promise<boolean> => {
      const r = await post<{ correct: boolean; view: KidView }>("/api/kid", { action: "answer", code: token, quizId, answer });
      if (r.ok) {
        apply(r.view);
        return r.correct;
      }
      await load(); // 잠금 등으로 거절되면 서버 상태로 되돌립니다.
      return false;
    },
    [apply, load, token],
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
      onAnswer={onAnswer}
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

