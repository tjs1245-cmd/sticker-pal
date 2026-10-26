"use client";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Opts = { x?: number; y?: number; big?: boolean };

/** 컨페티. 모션 줄이기 설정이면 아무것도 하지 않습니다. */
export async function burst({ x = 0.5, y = 0.6, big = false }: Opts = {}) {
  if (prefersReducedMotion()) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#fb7185", "#fbbf24", "#34d399", "#60a5fa", "#c084fc"];
  confetti({
    particleCount: big ? 160 : 40,
    spread: big ? 100 : 60,
    startVelocity: big ? 45 : 30,
    origin: { x, y },
    colors,
    zIndex: 100,
  });
  if (big) {
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, zIndex: 100 }), 250);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, zIndex: 100 }), 450);
  }
}
