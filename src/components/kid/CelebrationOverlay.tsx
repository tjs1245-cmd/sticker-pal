"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getTheme, stickerEmoji } from "@/lib/themes";
import { burst } from "./fx";
import { ROLE_ICON, ROLE_NAME, type Celebration } from "./types";

/** 암전 → 스티커가 회전하며 떨어져 쿵 → 컨페티 → 문구. 부모가 `key={celebration.id}` 로 새로 마운트합니다. */
export default function CelebrationOverlay({
  celebration,
  themeId,
  onDone,
}: {
  celebration: Celebration;
  themeId: string | null;
  onDone: () => void;
}) {
  const [landed, setLanded] = useState(false);
  const theme = getTheme(themeId);
  const who = ROLE_NAME[celebration.role];
  const isCoupon = celebration.type === "coupon";
  const isBonus = celebration.type === "bonus";

  useEffect(() => {
    const t = setTimeout(() => {
      setLanded(true);
      burst({ big: isCoupon });
    }, 1000);
    return () => clearTimeout(t);
  }, [isCoupon]);

  const title = isCoupon
    ? "스티커 30개 완성! 쿠폰이 생겼어요!"
    : isBonus
      ? `${who}가 보너스 스티커를 줬어요!`
      : `${who}가 승인했어요!`;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/70 px-6 text-center text-white"
    >
      <div className="relative">
        <motion.div
          initial={{ y: -700, rotate: -540, scale: 0.5 }}
          animate={{ y: 0, rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 9, mass: 1.3 }}
          className="grid h-40 w-40 place-items-center rounded-full bg-white text-8xl shadow-2xl"
        >
          {isCoupon ? "🎟️" : isBonus ? "🎁" : stickerEmoji(theme, celebration.slot)}
        </motion.div>
        {landed && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="absolute -right-3 -top-3 grid h-14 w-14 place-items-center rounded-full bg-yellow-300 text-3xl shadow-lg"
          >
            {ROLE_ICON[celebration.role]}
          </motion.span>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={landed ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        className="flex max-w-xs flex-col items-center gap-3"
      >
        <p className="text-3xl leading-snug">{title}</p>
        {isCoupon && <p className="text-lg opacity-90">{who}가 {celebration.bonus ? "보너스 스티커를 줬어요" : "승인했어요"}!</p>}
        {isBonus && celebration.note && (
          <p className="rounded-2xl bg-white px-4 py-3 text-xl text-[#3b2f63]">“{celebration.note}”</p>
        )}
        {isCoupon && celebration.note && (
          <p className="rounded-2xl bg-white px-4 py-3 text-xl text-[#3b2f63]">“{celebration.note}”</p>
        )}
        <motion.button
          type="button"
          onClick={onDone}
          whileTap={{ scale: 0.93 }}
          className="mt-2 rounded-full bg-pink-400 px-10 py-3 text-2xl shadow-lg"
        >
          {isCoupon ? "쿠폰 받기!" : "좋아!"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
