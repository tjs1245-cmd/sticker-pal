export type ThemeId = "dino" | "space" | "animals" | "dessert" | "car" | "unicorn";

export type Theme = {
  id: ThemeId;
  name: string;
  emoji: string;
  /** 스티커판 칸에 번갈아 붙는 그림 */
  stickers: string[];
  from: string;
  to: string;
  accent: string;
};

// id 는 supabase/schema.sql 의 themes 테이블과 같아야 합니다.
export const THEMES: Theme[] = [
  { id: "dino", name: "공룡", emoji: "🦖", stickers: ["🦖", "🦕", "🥚", "🌋"], from: "#bbf7d0", to: "#fef9c3", accent: "#16a34a" },
  { id: "space", name: "우주", emoji: "🚀", stickers: ["🚀", "🪐", "🌟", "👽"], from: "#c7d2fe", to: "#ddd6fe", accent: "#6366f1" },
  { id: "animals", name: "동물친구", emoji: "🐻", stickers: ["🐻", "🐰", "🐶", "🐱"], from: "#fed7aa", to: "#fef9c3", accent: "#ea580c" },
  { id: "dessert", name: "디저트", emoji: "🍰", stickers: ["🍰", "🍩", "🍦", "🧁"], from: "#fbcfe8", to: "#fef9c3", accent: "#db2777" },
  { id: "car", name: "자동차", emoji: "🚗", stickers: ["🚗", "🚒", "🚓", "🚜"], from: "#bae6fd", to: "#e0f2fe", accent: "#0284c7" },
  { id: "unicorn", name: "유니콘", emoji: "🦄", stickers: ["🦄", "🌈", "💖", "✨"], from: "#f5d0fe", to: "#fce7f3", accent: "#c026d3" },
];

export function getTheme(id: string | null | undefined): Theme | null {
  return THEMES.find((t) => t.id === id) ?? null;
}

export function stickerEmoji(theme: Theme | null, slot: number): string {
  const list = theme?.stickers ?? ["⭐"];
  return list[(slot - 1) % list.length];
}
