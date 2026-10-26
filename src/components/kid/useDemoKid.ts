"use client";

import { useCallback, useMemo, useState } from "react";
import type { Celebration, KidView, Role, StickerView } from "./types";

const BOARD_SIZE = 30;
// 데모의 오늘의 문제 (정답은 보기 번호 "1" = 2개)
const DEMO_QUIZ = { id: "demo-quiz", question: "토끼의 귀는 몇 개일까?", options: ["1개", "2개", "3개"], answer: "1" };
const BASE_DATE = Date.UTC(2026, 0, 5);

type DemoState = {
  dayOffset: number;
  routines: { id: string; name: string; emoji: string; done: boolean }[];
  quizSolved: boolean;
  status: "none" | "pending" | "approved" | "rejected";
  rejectNote: string | null;
  themeId: string | null;
  boardNo: number;
  stickers: StickerView[];
  boardFull: boolean;
  coupons: { id: string; title: string; used: boolean }[];
  celebration: Celebration | null;
  celebrationSeq: number;
};

const initial: DemoState = {
  dayOffset: 0,
  routines: [
    { id: "r1", name: "이 닦기", emoji: "🦷", done: false },
    { id: "r2", name: "장난감 정리", emoji: "🧸", done: false },
    { id: "r3", name: "책 읽기", emoji: "📚", done: false },
  ],
  quizSolved: false,
  status: "none",
  rejectNote: null,
  themeId: null,
  boardNo: 0,
  stickers: [],
  boardFull: false,
  coupons: [],
  celebration: null,
  celebrationSeq: 0,
};

function dateOf(offset: number): string {
  return new Date(BASE_DATE + offset * 86400000).toISOString().slice(0, 10);
}

function award(s: DemoState, kind: "routine" | "bonus", role: Role, note?: string | null): DemoState {
  if (!s.themeId || s.boardFull) return s;
  const slot = s.stickers.length + 1;
  if (slot > BOARD_SIZE) return s;
  const sticker: StickerView = { slot, kind, role, note: note || null, date: dateOf(s.dayOffset) };
  const full = slot === BOARD_SIZE;
  const seq = s.celebrationSeq + 1;
  return {
    ...s,
    stickers: [...s.stickers, sticker],
    boardFull: full,
    celebrationSeq: seq,
    celebration: {
      id: seq,
      type: full ? "coupon" : kind === "bonus" ? "bonus" : "sticker",
      role,
      note: note || null,
      slot,
      bonus: kind === "bonus",
    },
  };
}

/** Supabase 없이 같은 화면을 체험하는 데모용 상태 머신 */
export function useDemoKid() {
  const [s, setS] = useState<DemoState>(initial);

  const toggle = useCallback((id: string) => {
    setS((cur) => {
      if (cur.status === "pending" || cur.status === "approved" || !cur.themeId) return cur;
      const routines = cur.routines.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
      const allDone = routines.length > 0 && routines.every((r) => r.done) && cur.quizSolved;
      return { ...cur, routines, status: allDone ? "pending" : cur.status, rejectNote: allDone ? null : cur.rejectNote };
    });
  }, []);

  const answer = useCallback(
    async (_quizId: string, value: string): Promise<boolean> => {
      const correct = value === DEMO_QUIZ.answer;
      if (!correct) return false;
      setS((cur) => {
        if (!cur.themeId || cur.status === "pending" || cur.status === "approved" || cur.quizSolved) return cur;
        const allDone = cur.routines.length > 0 && cur.routines.every((r) => r.done);
        return { ...cur, quizSolved: true, status: allDone ? "pending" : cur.status, rejectNote: allDone ? null : cur.rejectNote };
      });
      return true;
    },
    [],
  );

  const pickTheme = useCallback((themeId: string) => {
    setS((cur) => (cur.themeId || cur.boardFull ? cur : { ...cur, themeId, boardNo: cur.boardNo + 1 }));
  }, []);

  const approve = useCallback((role: Role) => {
    setS((cur) => (cur.status === "pending" ? { ...award(cur, "routine", role), status: "approved" } : cur));
  }, []);

  const reject = useCallback((note?: string) => {
    setS((cur) =>
      cur.status === "pending"
        ? {
            ...cur,
            status: "rejected",
            rejectNote: note?.trim() || null,
            quizSolved: false,
            routines: cur.routines.map((r) => ({ ...r, done: false })),
          }
        : cur,
    );
  }, []);

  const bonus = useCallback((role: Role, note?: string) => {
    setS((cur) => award(cur, "bonus", role, note));
  }, []);

  const nextDay = useCallback(() => {
    setS((cur) => ({
      ...cur,
      dayOffset: cur.dayOffset + 1,
      quizSolved: false,
      status: "none",
      rejectNote: null,
      routines: cur.routines.map((r) => ({ ...r, done: false })),
    }));
  }, []);

  const fill29 = useCallback(() => {
    setS((cur) => {
      if (!cur.themeId || cur.boardFull) return cur;
      const stickers = [...cur.stickers];
      while (stickers.length < BOARD_SIZE - 1) {
        const slot = stickers.length + 1;
        stickers.push({
          slot,
          kind: "routine",
          role: slot % 2 ? "mom" : "dad",
          date: dateOf(cur.dayOffset - (BOARD_SIZE - slot)),
        });
      }
      return { ...cur, stickers };
    });
  }, []);

  const useCoupon = useCallback((id: string) => {
    setS((cur) => ({ ...cur, coupons: cur.coupons.map((c) => (c.id === id ? { ...c, used: true } : c)) }));
  }, []);

  const reset = useCallback(() => setS(initial), []);

  const finishCelebration = useCallback(() => {
    setS((cur) => {
      if (!cur.celebration) return cur;
      if (cur.celebration.type === "coupon" && cur.boardFull) {
        return {
          ...cur,
          celebration: null,
          boardFull: false,
          themeId: null,
          stickers: [],
          coupons: [{ id: `c${cur.coupons.length + 1}`, title: "장난감 쿠폰", used: false }, ...cur.coupons],
        };
      }
      return { ...cur, celebration: null };
    });
  }, []);

  const view: KidView = useMemo(
    () => ({
      kid: { name: "하늘", avatar: "🐻" },
      today: dateOf(s.dayOffset),
      needsTheme: !s.themeId && !s.boardFull,
      routines: s.routines,
      quiz: { id: DEMO_QUIZ.id, question: DEMO_QUIZ.question, kind: "choice", options: DEMO_QUIZ.options, solved: s.quizSolved },
      submission:
        s.status === "none" ? null : { status: s.status, note: s.status === "rejected" ? s.rejectNote : null },
      board: s.themeId ? { themeId: s.themeId, size: BOARD_SIZE, boardNo: s.boardNo } : null,
      stickers: s.stickers,
      coupons: s.coupons,
    }),
    [s],
  );

  return {
    view,
    celebration: s.celebration,
    canAct: { pending: s.status === "pending", hasBoard: !!s.themeId && !s.boardFull, coupons: s.coupons },
    actions: { toggle, answer, pickTheme, approve, reject, bonus, nextDay, fill29, useCoupon, reset, finishCelebration },
  };
}
