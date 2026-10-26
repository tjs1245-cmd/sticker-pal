"use client";

import { useState } from "react";
import { errorMessage, post } from "@/lib/apiClient";
import { ui } from "./ui";
import type { FamilyData, Kid, StickerRow } from "./useFamily";

type Mode = "redo" | "remove";

export default function StickersTab({ data, kid, refresh }: { data: FamilyData; kid: Kid; refresh: () => Promise<void> }) {
  const stickers = data.stickers.filter((s) => s.kid_id === kid.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("remove");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canRedo = (s: StickerRow) => s.kind === "routine" && s.date === data.today;

  function open(s: StickerRow) {
    if (openId === s.id) return setOpenId(null);
    setOpenId(s.id);
    setMode(canRedo(s) ? "redo" : "remove"); // 오늘 루틴 스티커는 '다시 하게 하기'가 기본
    setReason("");
  }

  async function submit(s: StickerRow) {
    setBusy(true);
    const r = await post("/api/parent", { action: "removeSticker", stickerId: s.id, mode, reason });
    setBusy(false);
    if (r.ok) {
      setMsg(
        mode === "redo"
          ? `${s.slot_no}번 스티커를 뺐어요. 아이가 오늘 루틴을 다시 할 수 있어요.`
          : `${s.slot_no}번 스티커를 뺐어요.`,
      );
      setOpenId(null);
    } else {
      setMsg(errorMessage(r.error));
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && (
        <p role="status" className="rounded-xl bg-violet-100 px-3 py-2">
          {msg}
        </p>
      )}
      <p className="text-sm opacity-70">
        지금 채우고 있는 판의 스티커예요. 쿠폰이 이미 나간 지난 판의 스티커는 뺄 수 없어요. 빼면 뒤 번호가 한 칸씩 당겨져요.
      </p>

      {stickers.length === 0 && <p className={`${ui.card} text-center opacity-70`}>아직 받은 스티커가 없어요.</p>}

      {stickers.map((s) => (
        <article key={s.id} className={`${ui.card} flex flex-col gap-2 !p-4`}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-100 text-lg">{s.slot_no}</span>
            <div className="min-w-0 flex-1">
              <p className="text-lg">
                {s.kind === "bonus" ? "🎁 보너스" : "⭐ 루틴"} · {s.awarded_role === "dad" ? "👨 아빠" : "👩 엄마"}
              </p>
              <p className="truncate text-sm opacity-70">
                {s.date}
                {s.note ? ` · “${s.note}”` : ""}
              </p>
            </div>
            <button type="button" onClick={() => open(s)} aria-expanded={openId === s.id} className={ui.ghost}>
              {openId === s.id ? "닫기" : "빼기"}
            </button>
          </div>

          {openId === s.id && (
            <form
              className="flex flex-col gap-3 rounded-2xl bg-rose-50 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(s);
              }}
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-base">어떻게 뺄까요?</legend>
                <label className={`flex items-start gap-2 rounded-xl bg-white p-3 ${canRedo(s) ? "" : "opacity-50"}`}>
                  <input
                    type="radio"
                    name={`mode-${s.id}`}
                    checked={mode === "redo"}
                    disabled={!canRedo(s)}
                    onChange={() => setMode("redo")}
                    className="mt-1 h-5 w-5 accent-violet-500"
                  />
                  <span>
                    <b>다시 하게 하기</b>
                    <span className="block text-sm opacity-80">
                      실수로 승인했을 때. 스티커를 빼고 오늘 승인을 취소해서 아이가 루틴을 다시 할 수 있어요.
                    </span>
                    {!canRedo(s) && (
                      <span className="block text-sm text-rose-600">
                        {s.kind === "bonus" ? "보너스 스티커는 다시 할 루틴이 없어요." : "오늘 받은 루틴 스티커만 고를 수 있어요."}
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-xl bg-white p-3">
                  <input
                    type="radio"
                    name={`mode-${s.id}`}
                    checked={mode === "remove"}
                    onChange={() => setMode("remove")}
                    className="mt-1 h-5 w-5 accent-violet-500"
                  />
                  <span>
                    <b>스티커만 빼기</b>
                    <span className="block text-sm opacity-80">
                      그날은 그대로 완료로 두고 스티커만 줄여요. 다시 할 수는 없어요.
                    </span>
                  </span>
                </label>
              </fieldset>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={40}
                placeholder="사유 (선택, 아이에게는 보이지 않아요)"
                aria-label="사유"
                className={ui.input}
              />
              <button type="submit" disabled={busy} className={ui.danger}>
                {busy ? "처리 중…" : `${s.slot_no}번 스티커 빼기`}
              </button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
