"use client";

import { useState } from "react";
import { errorMessage, post } from "@/lib/apiClient";
import { ui } from "./ui";
import type { FamilyData, Kid } from "./useFamily";

export default function CouponsTab({ data, kid, refresh }: { data: FamilyData; kid: Kid; refresh: () => Promise<void> }) {
  const [msg, setMsg] = useState("");
  const list = data.coupons.filter((c) => c.kid_id === kid.id);

  async function use(id: string) {
    const r = await post("/api/parent", { action: "useCoupon", id });
    setMsg(r.ok ? "사용 처리했어요." : errorMessage(r.error));
    if (r.ok) await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && <p className="rounded-xl bg-violet-100 px-3 py-2">{msg}</p>}
      {list.length === 0 && <p className={`${ui.card} text-center opacity-70`}>아직 쿠폰이 없어요. 스티커 30개를 모으면 생겨요!</p>}
      {list.map((c) => (
        <article key={c.id} className={`${ui.card} flex items-center justify-between gap-3 ${c.used_at ? "opacity-60" : ""}`}>
          <div>
            <p className="text-xl">🎟️ {c.title}</p>
            <p className="text-sm opacity-70">
              {new Date(c.created_at).toLocaleDateString("ko-KR")} 발급
              {c.used_at && ` · ${new Date(c.used_at).toLocaleDateString("ko-KR")} 사용`}
            </p>
          </div>
          {c.used_at ? (
            <span className="text-lg">사용 완료</span>
          ) : (
            <button type="button" onClick={() => use(c.id)} className={ui.primary}>
              사용 처리
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

