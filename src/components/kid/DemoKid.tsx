"use client";

import Link from "next/link";
import { useState } from "react";
import KidScreen from "./KidScreen";
import { ROLE_NAME, type Role } from "./types";
import { useDemoKid } from "./useDemoKid";

export default function DemoKid() {
  const { view, celebration, canAct, actions } = useDemoKid();

  return (
    <KidScreen
      view={view}
      onToggle={actions.toggle}
      onPickTheme={actions.pickTheme}
      celebration={celebration}
      onCelebrationDone={actions.finishCelebration}
      overlay={<DemoPanel canAct={canAct} actions={actions} today={view.today} />}
    />
  );
}

type Actions = ReturnType<typeof useDemoKid>["actions"];
type CanAct = ReturnType<typeof useDemoKid>["canAct"];

function DemoPanel({ canAct, actions, today }: { canAct: CanAct; actions: Actions; today: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const unused = canAct.coupons.filter((c) => !c.used);

  const btn =
    "rounded-xl bg-white px-3 py-2 text-base shadow disabled:opacity-35 active:scale-95 transition-transform";

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-full bg-white/80 px-3 py-1 text-base shadow">
          ← 처음으로
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full bg-violet-500 px-4 py-1 text-base text-white shadow"
          aria-expanded={open}
        >
          🛠 데모 컨트롤 {open ? "▲" : "▼"}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-3 rounded-3xl bg-violet-100/95 p-4 text-sm shadow-lg">
          <p className="text-base">
            부모 역할을 해 볼 수 있어요 · 오늘은 <b>{today}</b>
          </p>

          <div>
            <p className="mb-1">승인 요청이 오면</p>
            <div className="flex flex-wrap gap-2">
              {(["mom", "dad"] as Role[]).map((r) => (
                <button key={r} type="button" disabled={!canAct.pending} onClick={() => actions.approve(r)} className={btn}>
                  ✅ {ROLE_NAME[r]} 승인
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="한마디 (선택)"
                maxLength={40}
                className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-base"
              />
              <button
                type="button"
                disabled={!canAct.pending}
                onClick={() => {
                  actions.reject(rejectNote);
                  setRejectNote("");
                }}
                className={btn}
              >
                ↩️ 다시
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1">보너스 스티커 🎁</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="한마디 메모 (예: 동생 도와줘서 고마워!)"
              maxLength={40}
              className="mb-2 w-full rounded-xl bg-white px-3 py-2 text-base"
            />
            <div className="flex flex-wrap gap-2">
              {(["mom", "dad"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={!canAct.hasBoard}
                  onClick={() => {
                    actions.bonus(r, note);
                    setNote("");
                  }}
                  className={btn}
                >
                  🎁 {ROLE_NAME[r]} 보너스
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={actions.nextDay} className={btn}>
              🌙 내일로 넘기기
            </button>
            <button type="button" disabled={!canAct.hasBoard} onClick={actions.fill29} className={btn}>
              ⏩ 29개 채우기
            </button>
            <button
              type="button"
              disabled={unused.length === 0}
              onClick={() => unused[0] && actions.useCoupon(unused[0].id)}
              className={btn}
            >
              🎟️ 쿠폰 사용 처리
            </button>
            <button type="button" onClick={actions.reset} className={btn}>
              🔄 처음부터
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
