"use client";

import { useCallback, useEffect, useState } from "react";
import { post } from "@/lib/apiClient";

export type Kid = { id: string; name: string; avatar: string; view_token: string };
export type Routine = { id: string; kid_id: string; name: string; emoji: string; sort_no: number; active: boolean };
export type PendingSub = { id: string; kid_id: string; date: string; created_at: string };
export type Coupon = { id: string; kid_id: string; title: string; used_at: string | null; created_at: string };
export type Me = { id: string; role: "mom" | "dad"; login_id: string; family_id: string };

export type FamilyData = {
  me: Me;
  familyName: string;
  kids: Kid[];
  routines: Routine[];
  pending: PendingSub[];
  coupons: Coupon[];
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
