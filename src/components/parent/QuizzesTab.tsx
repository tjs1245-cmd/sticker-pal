"use client";

import { useState } from "react";
import { errorMessage, post } from "@/lib/apiClient";
import { ui } from "./ui";
import type { FamilyData, Kid, Quiz } from "./useFamily";

type Draft = {
  id: string | null;
  question: string;
  kind: "choice" | "short";
  options: string[];
  correctIndex: number;
  answers: string;
};

const EMPTY: Draft = { id: null, question: "", kind: "choice", options: ["", ""], correctIndex: 0, answers: "" };

function toDraft(q: Quiz): Draft {
  return {
    id: q.id,
    question: q.question,
    kind: q.kind,
    options: q.kind === "choice" ? [...(q.options ?? [])] : ["", ""],
    correctIndex: q.kind === "choice" ? Number(q.answer) : 0,
    answers: q.kind === "short" ? q.answer.split("|").join(", ") : "",
  };
}

export default function QuizzesTab({ data, kid, refresh }: { data: FamilyData; kid: Kid; refresh: () => Promise<void> }) {
  const quizzes = data.quizzes.filter((q) => q.kid_id === kid.id);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setOption = (i: number, v: string) => set({ options: draft.options.map((o, j) => (j === i ? v : o)) });

  const filledOptions = draft.options.map((o) => o.trim()).filter(Boolean);
  const valid =
    draft.question.trim().length > 0 &&
    (draft.kind === "choice"
      ? filledOptions.length >= 2 && draft.options[draft.correctIndex]?.trim().length > 0
      : draft.answers.trim().length > 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // 빈 보기를 빼면 정답 번호가 밀리므로, 정답 보기의 새 위치를 다시 계산합니다.
    const kept = draft.options.map((o, i) => ({ text: o.trim(), i })).filter((o) => o.text);
    const correct = kept.findIndex((o) => o.i === draft.correctIndex);
    setBusy(true);
    const r = await post("/api/parent", {
      action: draft.id ? "updateQuiz" : "addQuiz",
      id: draft.id ?? undefined,
      kidId: kid.id,
      question: draft.question.trim(),
      kind: draft.kind,
      options: kept.map((o) => o.text),
      correctIndex: correct,
      answers: draft.answers,
    });
    setBusy(false);
    setMsg(r.ok ? (draft.id ? "문제를 고쳤어요." : "문제를 만들었어요.") : errorMessage(r.error));
    if (r.ok) {
      setDraft(EMPTY);
      await refresh();
    }
  }

  async function remove(q: Quiz) {
    if (!confirm(`'${q.question}' 문제를 삭제할까요?`)) return;
    const r = await post("/api/parent", { action: "updateQuiz", id: q.id, active: false });
    setMsg(r.ok ? "삭제했어요." : errorMessage(r.error));
    if (draft.id === q.id) setDraft(EMPTY);
    if (r.ok) await refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && (
        <p role="status" className="rounded-xl bg-violet-100 px-3 py-2">
          {msg}
        </p>
      )}
      <p className="text-sm opacity-70">
        아이는 하루에 문제 1개를 풀어요. 오늘의 루틴을 다 하고 문제도 맞히면 승인 요청이 와요. 문제가 여러 개면 번갈아 나와요.
      </p>

      {quizzes.length === 0 && <p className={`${ui.card} text-center opacity-70`}>아직 문제가 없어요. 아래에서 만들어 보세요.</p>}
      {quizzes.map((q) => (
        <article key={q.id} className={`${ui.card} flex flex-col gap-2 !p-4`}>
          <p className="text-lg">🧠 {q.question}</p>
          {q.kind === "choice" ? (
            <ol className="flex flex-col gap-1 text-base">
              {(q.options ?? []).map((o, i) => (
                <li key={i} className={Number(q.answer) === i ? "text-green-700" : "opacity-70"}>
                  {i + 1}. {o} {Number(q.answer) === i && "✅ 정답"}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-base text-green-700">정답: {q.answer.split("|").join(" / ")}</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(toDraft(q))} className={ui.ghost}>
              수정
            </button>
            <button type="button" onClick={() => remove(q)} className={`${ui.danger} ml-auto`}>
              삭제
            </button>
          </div>
        </article>
      ))}

      <form onSubmit={save} className={`${ui.card} flex flex-col gap-3`}>
        <h2 className="text-xl">{draft.id ? "문제 고치기" : "새 문제 만들기"}</h2>
        <label className="flex flex-col gap-1">
          문제
          <input
            value={draft.question}
            onChange={(e) => set({ question: e.target.value })}
            maxLength={200}
            placeholder="예: 토끼의 귀는 몇 개일까?"
            className={ui.input}
          />
        </label>

        <div className="flex gap-2" role="radiogroup" aria-label="문제 종류">
          {(
            [
              ["choice", "객관식"],
              ["short", "짧은 주관식"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draft.kind === k}
              onClick={() => set({ kind: k })}
              className={`flex-1 rounded-xl px-3 py-2 shadow ${draft.kind === k ? "bg-violet-500 text-white" : "bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {draft.kind === "choice" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-base">보기 (정답을 동그라미로 골라요)</legend>
            {draft.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={draft.correctIndex === i}
                  onChange={() => set({ correctIndex: i })}
                  aria-label={`${i + 1}번 보기를 정답으로`}
                  className="h-5 w-5 accent-violet-500"
                />
                <input
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  maxLength={40}
                  placeholder={`보기 ${i + 1}`}
                  aria-label={`보기 ${i + 1}`}
                  className={ui.input}
                />
              </div>
            ))}
            {draft.options.length < 4 && (
              <button type="button" onClick={() => set({ options: [...draft.options, ""] })} className={`${ui.ghost} self-start`}>
                ＋ 보기 추가
              </button>
            )}
          </fieldset>
        ) : (
          <label className="flex flex-col gap-1">
            정답 (여러 개면 쉼표로 구분해요)
            <input
              value={draft.answers}
              onChange={(e) => set({ answers: e.target.value })}
              maxLength={100}
              placeholder="예: 두 개, 2개, 2"
              className={ui.input}
            />
            <span className="text-sm opacity-70">띄어쓰기와 영어 대소문자는 신경 쓰지 않아요.</span>
          </label>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={!valid || busy} className={`${ui.primary} flex-1`}>
            {draft.id ? "저장" : "문제 만들기"}
          </button>
          {draft.id && (
            <button type="button" onClick={() => setDraft(EMPTY)} className={ui.ghost}>
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
