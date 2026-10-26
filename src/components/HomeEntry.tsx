"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";

const KEY = "sticker-pal:last-code";
const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function readLast(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export default function HomeEntry() {
  const router = useRouter();
  const last = useSyncExternalStore(subscribe, readLast, () => null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function go(value: string) {
    const c = value.trim().toUpperCase();
    if (!CODE_RE.test(c)) {
      setError("코드는 6글자예요. 다시 확인해 줄래요?");
      return;
    }
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* 저장이 막혀 있어도 이동은 됩니다 */
    }
    router.push(`/kid/${c}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <motion.div
        animate={{ y: [0, -14, 0], rotate: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        className="text-8xl"
      >
        ⭐
      </motion.div>
      <h1 className="text-5xl">스티커 친구</h1>
      <p className="text-xl opacity-80">매일 루틴을 지키고 스티커 30개를 모아 보자!</p>

      <form
        className="w-full rounded-3xl bg-white/85 p-5 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          go(code);
        }}
      >
        <label htmlFor="kid-code" className="mb-2 block text-2xl">
          내 코드를 넣어 줘
        </label>
        <input
          id="kid-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            setError("");
          }}
          maxLength={6}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABC234"
          className="w-full rounded-2xl border-4 border-pink-200 bg-white px-4 py-3 text-center text-4xl tracking-[0.3em] outline-none focus:border-pink-400"
        />
        {error && <p className="mt-2 text-lg text-rose-500">{error}</p>}
        <button type="submit" className="mt-4 w-full rounded-2xl bg-pink-400 py-4 text-2xl text-white shadow-md active:scale-95">
          들어가기 🚀
        </button>
        {last && (
          <button
            type="button"
            onClick={() => go(last)}
            className="mt-3 w-full rounded-2xl bg-yellow-200 py-3 text-xl shadow active:scale-95"
          >
            마지막으로 연 코드 {last}
          </button>
        )}
      </form>

      <div className="flex flex-col items-center gap-3 text-lg">
        <Link href="/kid/demo" className="rounded-full bg-violet-500 px-6 py-3 text-xl text-white shadow">
          🎮 데모로 먼저 체험하기
        </Link>
        <Link href="/parent" className="underline decoration-dotted underline-offset-4">
          부모 로그인
        </Link>
      </div>
    </main>
  );
}
