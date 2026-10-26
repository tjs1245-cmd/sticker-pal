"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { THEMES } from "@/lib/themes";

export default function ThemePicker({ onPick, first }: { onPick: (id: string) => void; first?: boolean }) {
  const [sel, setSel] = useState<string | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-white/80 p-5 shadow-lg backdrop-blur"
    >
      <h2 className="text-center text-2xl">{first ? "어떤 스티커판으로 시작할까?" : "다음 스티커판을 골라 봐!"}</h2>
      <p className="mt-1 text-center text-sm opacity-70">옆으로 밀어서 구경해 보세요 👉</p>

      <div className="no-scrollbar -mx-5 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3">
        {THEMES.map((t, i) => {
          const on = sel === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => setSel(t.id)}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0, scale: on ? 1.05 : 1 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 18 }}
              whileTap={{ scale: 0.94 }}
              className="relative flex h-44 w-36 shrink-0 snap-center flex-col items-center justify-center gap-2 rounded-3xl border-4 shadow-md"
              style={{
                background: `linear-gradient(160deg, ${t.from}, ${t.to})`,
                borderColor: on ? t.accent : "white",
              }}
              aria-pressed={on}
            >
              <span className="text-6xl">{t.emoji}</span>
              <span className="text-xl">{t.name}</span>
              <span className="text-sm opacity-60">{t.stickers.join(" ")}</span>
              {on && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-white text-xl shadow"
                >
                  ✅
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      <motion.button
        type="button"
        disabled={!sel}
        onClick={() => sel && onPick(sel)}
        whileTap={{ scale: 0.95 }}
        className="mt-2 w-full rounded-2xl bg-pink-400 py-4 text-2xl text-white shadow-md disabled:opacity-40"
      >
        {sel ? "이 판으로 시작! 🎉" : "하나를 골라 줘"}
      </motion.button>
    </motion.section>
  );
}
