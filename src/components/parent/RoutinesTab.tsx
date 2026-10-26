"use client";

import { useState } from "react";
import { errorMessage, post } from "@/lib/apiClient";
import { ui } from "./ui";
import type { FamilyData, Kid, Routine } from "./useFamily";

export default function RoutinesTab({ data, kid, refresh }: { data: FamilyData; kid: Kid; refresh: () => Promise<void> }) {
  const routines = data.routines.filter((r) => r.kid_id === kid.id).sort((a, b) => a.sort_no - b.sort_no);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [msg, setMsg] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await post("/api/parent", { action: "addRoutine", kidId: kid.id, name: name.trim(), emoji: emoji.trim() || "⭐" });
    setMsg(r.ok ? "" : errorMessage(r.error));
    if (r.ok) {
      setName("");
      await refresh();
    }
  }

  async function move(i: number, dir: -1 | 1) {
    if (!routines[i + dir]) return;
    const ids = routines.map((r) => r.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    // 위치 기준으로 sort_no 를 다시 매깁니다.
    const r = await post("/api/parent", { action: "reorderRoutines", kidId: kid.id, ids });
    if (!r.ok) setMsg(errorMessage(r.error));
    await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && <p className="rounded-xl bg-yellow-100 px-3 py-2">{msg}</p>}
      <p className="text-sm opacity-70">루틴이 0개면 스티커를 받을 수 없어요. 삭제해도 지난 기록은 남아요.</p>

      {routines.map((r, i) => (
        <RoutineRow
          key={r.id + r.name + r.emoji}
          routine={r}
          first={i === 0}
          last={i === routines.length - 1}
          onMove={(d) => move(i, d)}
          onChanged={refresh}
          onError={setMsg}
        />
      ))}
      {routines.length === 0 && <p className={`${ui.card} text-center opacity-70`}>루틴을 추가해 주세요.</p>}

      <form onSubmit={add} className={`${ui.card} flex gap-2`}>
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="이모지" className={`${ui.input} !w-16 text-center`} />
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="새 루틴 이름" aria-label="루틴 이름" className={ui.input} />
        <button type="submit" disabled={!name.trim()} className={ui.primary}>
          추가
        </button>
      </form>
    </div>
  );
}

function RoutineRow({
  routine,
  first,
  last,
  onMove,
  onChanged,
  onError,
}: {
  routine: Routine;
  first: boolean;
  last: boolean;
  onMove: (d: -1 | 1) => void;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(routine.name);
  const [emoji, setEmoji] = useState(routine.emoji);
  const dirty = name.trim() !== routine.name || emoji !== routine.emoji;

  async function update(patch: Partial<Routine>) {
    const r = await post("/api/parent", { action: "updateRoutine", id: routine.id, ...patch });
    onError(r.ok ? "" : errorMessage(r.error));
    if (r.ok) await onChanged();
  }

  return (
    <div className={`${ui.card} flex flex-col gap-2 !p-3`}>
      <div className="flex gap-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="이모지" className={`${ui.input} !w-16 text-center`} />
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="루틴 이름" className={ui.input} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={first} onClick={() => onMove(-1)} className={ui.ghost} aria-label="위로">
          ▲
        </button>
        <button type="button" disabled={last} onClick={() => onMove(1)} className={ui.ghost} aria-label="아래로">
          ▼
        </button>
        <button type="button" disabled={!dirty || !name.trim()} onClick={() => update({ name: name.trim(), emoji: emoji.trim() || "⭐" })} className={ui.primary}>
          저장
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`'${routine.name}' 루틴을 삭제할까요? 지난 기록은 남아요.`)) update({ active: false });
          }}
          className={`${ui.danger} ml-auto`}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

