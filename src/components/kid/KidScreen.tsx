"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getTheme, stickerEmoji } from "@/lib/themes";
import CelebrationOverlay from "./CelebrationOverlay";
import ThemePicker from "./ThemePicker";
import { burst } from "./fx";
import { ROLE_ICON, ROLE_NAME, type Celebration, type KidView } from "./types";

type Tab = "today" | "board" | "coupons";

type Props = {
  view: KidView;
  onToggle: (routineId: string) => void;
  onPickTheme: (themeId: string) => void;
  /** 오늘의 문제 답 제출. 맞았는지 돌려줍니다. */
  onAnswer?: (quizId: string, answer: string) => Promise<boolean>;
  celebration: Celebration | null;
  onCelebrationDone: () => void;
  /** 데모 컨트롤 등 화면 위에 얹을 것 */
  overlay?: ReactNode;
};

export default function KidScreen({ view, onToggle, onPickTheme, onAnswer, celebration, onCelebrationDone, overlay }: Props) {
  const [tab, setTab] = useState<Tab>("today");
  const theme = getTheme(view.board?.themeId);
  const unusedCoupons = view.coupons.filter((c) => !c.used).length;

  // 스티커 발급 연출이 시작되면 판 화면을 뒤에 깔아 둡니다(스티커가 판에 붙는 느낌)
  const celebrationId = celebration?.id ?? null;
  useEffect(() => {
    if (celebrationId === null) return;
    const t = setTimeout(() => setTab("board"), 0);
    return () => clearTimeout(t);
  }, [celebrationId]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-28 pt-5"
        style={
          theme
            ? ({ "--sky-from": theme.from, "--sky-to": "#ffffff" } as React.CSSProperties)
            : undefined
        }
      >
        {overlay}

        <AnimatePresence mode="wait">
          <motion.main
            key={tab + (view.needsTheme ? "-theme" : "")}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="flex flex-1 flex-col gap-4"
          >
            {tab === "today" && <TodayTab view={view} onToggle={onToggle} onPickTheme={onPickTheme} onAnswer={onAnswer} />}
            {tab === "board" && <BoardTab view={view} onPickTheme={onPickTheme} />}
            {tab === "coupons" && <CouponsTab view={view} />}
          </motion.main>
        </AnimatePresence>

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md gap-2 bg-white/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur">
          {(
            [
              ["today", "🌞", "오늘"],
              ["board", "⭐", "스티커판"],
              ["coupons", "🎟️", "쿠폰"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`relative flex-1 rounded-2xl py-2 text-lg transition-colors ${
                tab === id ? "bg-pink-400 text-white shadow" : "bg-transparent text-[#3b2f63]/70"
              }`}
            >
              <motion.span animate={tab === id ? { scale: [1, 1.3, 1] } : { scale: 1 }} className="block text-2xl">
                {icon}
              </motion.span>
              {label}
              {id === "coupons" && unusedCoupons > 0 && (
                <span className="absolute right-3 top-0 grid h-6 min-w-6 place-items-center rounded-full bg-yellow-300 px-1 text-sm text-[#3b2f63]">
                  {unusedCoupons}
                </span>
              )}
            </button>
          ))}
        </nav>

        <AnimatePresence>
          {celebration && (
            <CelebrationOverlay
              key={celebration.id}
              celebration={celebration}
              themeId={view.board?.themeId ?? null}
              onDone={onCelebrationDone}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/* ───────────────────────── 오늘 ───────────────────────── */

function Character({ avatar, message }: { avatar: string; message: string }) {
  return (
    <div className="flex items-end gap-3">
      <motion.div
        animate={{ y: [0, -16, 0], scaleY: [1, 0.94, 1] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
        className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-white text-6xl shadow-lg"
      >
        {avatar}
      </motion.div>
      <div className="relative mb-2 rounded-3xl rounded-bl-md bg-white px-4 py-3 text-lg shadow">{message}</div>
    </div>
  );
}

function ProgressBar({ value, max, color = "#f472b6" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-5 w-full overflow-hidden rounded-full bg-white/80 shadow-inner"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />
    </div>
  );
}

function TodayTab({
  view,
  onToggle,
  onPickTheme,
  onAnswer,
}: {
  view: KidView;
  onToggle: (id: string) => void;
  onPickTheme: (id: string) => void;
  onAnswer?: (quizId: string, answer: string) => Promise<boolean>;
}) {
  const quiz = onAnswer ? (view.quiz ?? null) : null;
  // 오늘의 문제도 루틴 한 칸으로 셉니다.
  const total = view.routines.length + (quiz ? 1 : 0);
  const done = view.routines.filter((r) => r.done).length + (quiz?.solved ? 1 : 0);
  const status = view.submission?.status;
  const locked = status === "pending" || status === "approved";

  if (view.needsTheme) {
    return (
      <>
        <Character avatar={view.kid.avatar} message={`${view.kid.name}아, 안녕! 🎉`} />
        <ThemePicker onPick={onPickTheme} first={view.coupons.length === 0} />
      </>
    );
  }

  let message = `${view.kid.name}아, 오늘도 해볼까?`;
  if (total === 0) message = "부모님이 루틴을 만들어 주면 시작할 수 있어요!";
  else if (status === "pending") message = "두근두근… 기다리는 중이야!";
  else if (status === "approved")
    message = view.submission?.hasSticker === false ? "오늘은 여기까지! 내일 또 만나요 🌙" : "오늘 스티커 완료! 내일 또 만나요 🌙";
  else if (status === "rejected" || status === "cancelled") message = "조금만 더 해볼까? 💪";
  else if (done > 0) message = `좋아! ${total - done}개만 더!`;

  return (
    <>
      <Character avatar={view.kid.avatar} message={message} />

      {status === "rejected" && view.submission?.note && (
        <div className="rounded-2xl bg-yellow-100 px-4 py-3 text-lg shadow">💌 “{view.submission.note}”</div>
      )}

      <div>
        <div className="mb-1 flex justify-between px-1 text-lg">
          <span>오늘의 루틴</span>
          <span>
            {done} / {total}
          </span>
        </div>
        <ProgressBar value={done} max={total} />
      </div>

      <ul className="flex flex-col gap-3">
        {view.routines.map((r, i) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <RoutineCard routine={r} locked={locked} onToggle={onToggle} />
          </motion.li>
        ))}
      </ul>

      {quiz && onAnswer && <QuizCard key={quiz.id} quiz={quiz} locked={locked} onAnswer={onAnswer} />}

      <AnimatePresence>
        {status === "pending" && <PendingLetter />}
        {status === "approved" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl bg-green-100 px-4 py-4 text-center text-xl shadow"
          >
            {view.submission?.hasSticker === false ? "✅ 오늘 루틴은 끝났어요!" : "✅ 오늘 스티커를 받았어요!"}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QuizCard({
  quiz,
  locked,
  onAnswer,
}: {
  quiz: NonNullable<KidView["quiz"]>;
  locked: boolean;
  onAnswer: (quizId: string, answer: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<"idle" | "wrong">("idle");
  const [wrongCount, setWrongCount] = useState(0); // 틀릴 때마다 흔들림 애니메이션을 다시 재생
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function submit(answer: string) {
    if (busy || locked || quiz.solved || !answer.trim()) return;
    setBusy(true);
    const ok = await onAnswer(quiz.id, answer);
    setBusy(false);
    if (ok) {
      setResult("idle");
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        burst({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
      }
    } else {
      setResult("wrong");
      setWrongCount((n) => n + 1);
      setText("");
    }
  }

  if (quiz.solved) {
    return (
      <motion.div
        ref={ref}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-3 rounded-3xl border-4 border-green-400 bg-green-100 px-5 py-4 shadow-md"
      >
        <span className="text-5xl">🧠</span>
        <div className="flex-1">
          <p className="text-lg opacity-70">오늘의 문제</p>
          <p className="text-xl">{quiz.question}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-green-500 text-2xl text-white">✓</span>
      </motion.div>
    );
  }

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col gap-3 rounded-3xl border-4 border-violet-300 bg-white px-5 py-4 shadow-md ${locked ? "opacity-80" : ""}`}
    >
      <p className="text-lg opacity-70">🧠 오늘의 문제</p>
      <p className="text-2xl leading-snug">{quiz.question}</p>

      {quiz.kind === "choice" ? (
        <div className="flex flex-col gap-2">
          {(quiz.options ?? []).map((o, i) => (
            <motion.button
              key={i}
              type="button"
              disabled={busy || locked}
              onClick={() => submit(String(i))}
              whileTap={{ scale: 0.96 }}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-violet-100 px-4 py-2 text-left text-xl shadow disabled:opacity-60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-400 text-white">{i + 1}</span>
              {o}
            </motion.button>
          ))}
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult("idle");
            }}
            maxLength={100}
            disabled={busy || locked}
            aria-label="정답 입력"
            placeholder="정답을 써 줘"
            className="min-w-0 flex-1 rounded-2xl border-4 border-violet-200 px-4 py-3 text-xl outline-none focus:border-violet-400"
          />
          <button type="submit" disabled={busy || locked || !text.trim()} className="rounded-2xl bg-violet-500 px-5 text-xl text-white shadow disabled:opacity-40">
            확인!
          </button>
        </form>
      )}

      {result === "wrong" && (
        <motion.p
          key={wrongCount}
          role="status"
          animate={{ x: [0, -8, 8, -6, 6, 0] }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-yellow-100 px-4 py-2 text-center text-xl"
        >
          아쉬워! 다시 해볼까? 💪
        </motion.p>
      )}
    </motion.section>
  );
}

function RoutineCard({
  routine,
  locked,
  onToggle,
}: {
  routine: { id: string; name: string; emoji: string; done: boolean };
  locked: boolean;
  onToggle: (id: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  function handle() {
    if (locked) return;
    if (!routine.done && ref.current) {
      const r = ref.current.getBoundingClientRect();
      burst({ x: (r.left + r.width - 40) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
    }
    onToggle(routine.id);
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={handle}
      disabled={locked}
      aria-pressed={routine.done}
      whileTap={locked ? undefined : { scale: 0.96 }}
      className={`flex min-h-20 w-full items-center gap-4 rounded-3xl border-4 px-5 py-3 text-left shadow-md transition-colors ${
        routine.done ? "border-green-400 bg-green-100" : "border-white bg-white"
      } ${locked ? "opacity-80" : ""}`}
    >
      <span className="text-5xl">{routine.emoji}</span>
      <span className="flex-1 text-2xl">{routine.name}</span>
      <motion.span
        key={String(routine.done)}
        initial={{ scale: routine.done ? 0.2 : 1, rotate: routine.done ? -40 : 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 12 }}
        className={`grid h-12 w-12 place-items-center rounded-full border-4 text-2xl ${
          routine.done ? "border-green-500 bg-green-500 text-white" : "border-gray-300 bg-white text-transparent"
        }`}
      >
        ✓
      </motion.span>
    </motion.button>
  );
}

function PendingLetter() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-3xl bg-white px-4 py-5 text-center shadow-lg"
    >
      <div className="relative h-16">
        <motion.span
          className="absolute left-0 top-2 text-5xl"
          animate={{ x: [0, 130, 270], y: [0, -26, 6], rotate: [-10, 8, 20], opacity: [1, 1, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        >
          ✉️
        </motion.span>
        <span className="absolute right-4 top-1 text-5xl">
          {ROLE_ICON.mom}
          {ROLE_ICON.dad}
        </span>
      </div>
      <p className="text-xl">엄마·아빠에게 알렸어요…</p>
      <motion.p
        className="mt-1 text-2xl text-pink-500"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.9 }}
      >
        두근두근 💗
      </motion.p>
    </motion.div>
  );
}

/* ───────────────────────── 스티커판 ───────────────────────── */

function BoardTab({ view, onPickTheme }: { view: KidView; onPickTheme: (id: string) => void }) {
  if (view.needsTheme || !view.board) {
    return <ThemePicker onPick={onPickTheme} first={view.coupons.length === 0} />;
  }
  const theme = getTheme(view.board.themeId);
  const size = view.board.size;
  const count = view.stickers.length;
  const bySlot = new Map(view.stickers.map((s) => [s.slot, s]));
  const mom = view.stickers.filter((s) => s.role === "mom").length;
  const dad = view.stickers.filter((s) => s.role === "dad").length;
  const nearly = count >= 25 && count < size;

  return (
    <>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl">
          {theme?.emoji} {theme?.name} 스티커판
        </h2>
        <span className="rounded-full bg-white px-3 py-1 text-lg shadow">
          {count} / {size}
        </span>
      </div>

      <ProgressBar value={count} max={size} color={theme?.accent} />

      {nearly && (
        <motion.p
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="text-center text-2xl text-pink-500"
        >
          조금만 더! 🔥 {size - count}개 남았어요
        </motion.p>
      )}

      <div className="grid grid-cols-5 gap-2 rounded-3xl bg-white/80 p-3 shadow-lg">
        {Array.from({ length: size }, (_, i) => {
          const slot = i + 1;
          const st = bySlot.get(slot);
          if (st) {
            return (
              <motion.div
                key={slot}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 14, delay: Math.min(i, 12) * 0.02 }}
                className="relative grid aspect-square place-items-center rounded-2xl text-3xl shadow"
                style={{ background: `linear-gradient(135deg, ${theme?.from ?? "#fef9c3"}, white)` }}
                title={st.note ?? undefined}
              >
                {st.kind === "bonus" ? "🎁" : stickerEmoji(theme, slot)}
                <span className="absolute -bottom-1 -right-1 text-sm">{ROLE_ICON[st.role]}</span>
              </motion.div>
            );
          }
          const next = slot === count + 1;
          return (
            <motion.div
              key={slot}
              animate={next ? { opacity: [0.35, 1, 0.35], scale: [1, 1.08, 1] } : { opacity: 1 }}
              transition={next ? { repeat: Infinity, duration: 1.3 } : undefined}
              className={`grid aspect-square place-items-center rounded-2xl border-2 border-dashed text-lg ${
                next ? "border-pink-400 text-pink-400" : "border-gray-300 text-gray-300"
              } ${slot === size ? "text-2xl" : ""}`}
            >
              {slot === size ? "🎟️" : slot}
            </motion.div>
          );
        })}
      </div>

      <p className="rounded-2xl bg-white/80 px-4 py-3 text-center text-xl shadow">
        {ROLE_ICON.mom} {ROLE_NAME.mom} {mom}개 · {ROLE_ICON.dad} {ROLE_NAME.dad} {dad}개
      </p>

      {view.stickers.some((s) => s.kind === "bonus") && (
        <p className="text-center text-base opacity-70">🎁 는 부모님이 특별히 준 보너스 스티커예요</p>
      )}
    </>
  );
}

/* ───────────────────────── 쿠폰 ───────────────────────── */

function CouponsTab({ view }: { view: KidView }) {
  if (view.coupons.length === 0) {
    return (
      <div className="mt-10 rounded-3xl bg-white/80 p-8 text-center shadow-lg">
        <div className="text-6xl">🎟️</div>
        <p className="mt-3 text-2xl">아직 쿠폰이 없어요</p>
        <p className="mt-1 text-lg opacity-70">스티커 30개를 모으면 장난감 쿠폰이 생겨요!</p>
      </div>
    );
  }
  return (
    <>
      <h2 className="px-1 text-2xl">내 쿠폰</h2>
      <ul className="flex flex-col gap-4">
        {view.coupons.map((c) => (
          <li key={c.id}>
            <CouponCard title={c.title} used={c.used} />
          </li>
        ))}
      </ul>
    </>
  );
}

function CouponCard({ title, used }: { title: string; used: boolean }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="block h-44 w-full [perspective:1000px]"
      aria-label={`${title} ${used ? "사용 완료" : "눌러서 뒤집기"}`}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 16 }}
        className="relative h-full w-full [transform-style:preserve-3d]"
      >
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-white text-white shadow-lg [backface-visibility:hidden] ${
            used ? "bg-gray-400 grayscale" : "bg-gradient-to-br from-pink-400 to-orange-300"
          }`}
        >
          <span className="text-6xl">🎟️</span>
          <span className="text-3xl">{title}</span>
          <span className="text-base opacity-90">{used ? "사용 완료" : "눌러 보세요!"}</span>
        </div>
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-3xl border-4 border-white px-4 text-center shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            used ? "bg-gray-200 text-gray-500 grayscale" : "bg-yellow-100"
          }`}
        >
          <span className="text-5xl">{used ? "✔️" : "🧸"}</span>
          <span className="text-2xl">{used ? "이미 사용한 쿠폰이에요" : "엄마·아빠에게 보여 주세요!"}</span>
          <span className="text-base opacity-70">{used ? "" : "장난감과 바꿀 수 있어요"}</span>
        </div>
      </motion.div>
    </button>
  );
}
