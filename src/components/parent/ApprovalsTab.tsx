"use client";

import { useState } from "react";
import { errorMessage, post } from "@/lib/apiClient";
import { ui } from "./ui";
import type { FamilyData, Kid } from "./useFamily";

type Props = { data: FamilyData; kid: Kid | null; refresh: () => Promise<void> };

export default function ApprovalsTab({ data, kid, refresh }: Props) {
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [bonusNote, setBonusNote] = useState("");

  const kidName = (id: string) => data.kids.find((k) => k.id === id);

  async function call(id: string, action: string, args: Record<string, unknown>, okMsg: string) {
    setBusyId(id);
    const r = await post("/api/parent", { action, ...args });
    setBusyId(null);
    setMsg(r.ok ? okMsg : errorMessage(r.error));
    if (r.ok) await refresh();
    return r.ok;
  }

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <p role="status" className="rounded-xl bg-violet-100 px-3 py-2">
          {msg}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">승인 요청</h2>
        {data.pending.length === 0 && <p className={`${ui.card} text-center opacity-70`}>기다리는 요청이 없어요 🎉</p>}
        {data.pending.map((p) => {
          const k = kidName(p.kid_id);
          return (
            <article key={p.id} className={`${ui.card} flex flex-col gap-3`}>
              <p className="text-xl">
                {k?.avatar} {k?.name} · <b>{p.date}</b> 루틴을 다 했어요!
              </p>
              {rejecting === p.id ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await call(p.id, "reject", { submissionId: p.id, note: rejectNote }, "다시 해 보자고 전했어요.")) {
                      setRejecting(null);
                      setRejectNote("");
                    }
                  }}
                >
                  <input
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    maxLength={40}
                    placeholder="한마디 (선택) 예: 양치는 꼼꼼히 해 보자!"
                    className={ui.input}
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busyId === p.id} className={ui.primary}>
                      다시 해 보자고 보내기
                    </button>
                    <button type="button" onClick={() => setRejecting(null)} className={ui.ghost}>
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => call(p.id, "approve", { submissionId: p.id }, "스티커를 줬어요! 🌟")}
                    className={`${ui.primary} flex-1`}
                  >
                    ✅ 승인
                  </button>
                  <button type="button" onClick={() => setRejecting(p.id)} className={ui.ghost}>
                    ↩️ 다시
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {kid && (
        <section className={`${ui.card} flex flex-col gap-3`}>
          <h2 className="text-xl">🎁 {kid.name}에게 보너스 스티커</h2>
          <input
            value={bonusNote}
            onChange={(e) => setBonusNote(e.target.value)}
            maxLength={40}
            placeholder="한마디 메모 (예: 동생 도와줘서 고마워!)"
            className={ui.input}
          />
          <button
            type="button"
            disabled={busyId === "bonus"}
            onClick={async () => {
              if (await call("bonus", "bonus", { kidId: kid.id, note: bonusNote }, "보너스 스티커를 줬어요! 🎁")) setBonusNote("");
            }}
            className={ui.primary}
          >
            보너스 스티커 주기
          </button>
          <p className="text-sm opacity-70">요청 없이 줄 수 있고, 하루에 몇 개든 괜찮아요.</p>
        </section>
      )}
    </div>
  );
}

