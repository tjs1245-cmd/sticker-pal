"use client";

import { useCallback, useEffect, useState } from "react";
import { post } from "@/lib/apiClient";

export type Kid = { id: string; name: string; avatar: string; view_token: string };
export type Routine = { id: string; kid_id: string; name: string; emoji: string; sort_no: number; active: boolean };
export type PendingSub = { id: string; kid_id: string; date: string; created_at: string };
export type Coupon = { id: string; kid_id: string; title: string; used_at: string | null; created_at: string };
export type Quiz = {
  id: string;
  kid_id: string;
  question: string;
  kind: "choice" | "short";
  options: string[] | null;
  /** 객관식: 정답 보기 번호(0부터), 주관식: 정답들을 | 로 구분 */
  answer: string;
};
export type StickerRow = {
  id: string;
  kid_id: string;
  slot_no: number;
  kind: "routine" | "bonus";
  date: string;
  awarded_role: "mom" | "dad" | null;
  note: string | null;
};
export type Me = { id: string; role: "mom" | "dad"; login_id: string; family_id: string };

export type FamilyData = {
  me: Me;
  familyName: string;
  /** 가족 시간대 기준 오늘 (YYYY-MM-DD) */
  today: string;
  stickers: StickerRow[];
  kids: Kid[];
  routines: Routine[];
  pending: PendingSub[];
  coupons: Coupon[];
  quizzes: Quiz[];
};

/** 로그인한 부모의 가족 데이터. 8초마다 다시 읽습니다(승인함 갱신). 세션이 끝나면 onExpired 를 부릅니다. */
export function useFamily(enabled: boolean, onExpired: () => void) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await post<FamilyData>("/api/parent", { action: "data" });
    if (r.ok) {
      const { ok: _ok, ...rest } = r;
      void _ok;
      setData(rest as FamilyData);
      setError(null);
    } else if (r.error === "unauthorized") {
      onExpired();
    } else {
      setError(r.error);
    }
  }, [onExpired]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const t = setInterval(() => {
      if (!document.hidden) refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  return { data, error, refresh };
}
