export type Role = "mom" | "dad";

export const ROLE_NAME: Record<Role, string> = { mom: "엄마", dad: "아빠" };
export const ROLE_ICON: Record<Role, string> = { mom: "👩", dad: "👨" };

export type StickerView = {
  slot: number;
  kind: "routine" | "bonus";
  role: Role;
  note?: string | null;
  date: string;
};

export type RoutineView = { id: string; name: string; emoji: string; done: boolean };

/** kid_view RPC 가 돌려주는 모양과 같습니다. */
export type KidView = {
  kid: { name: string; avatar: string };
  today: string;
  needsTheme: boolean;
  routines: RoutineView[];
  submission: { status: "pending" | "approved" | "rejected" | "cancelled"; note?: string | null } | null;
  board: { themeId: string; size: number; boardNo: number } | null;
  stickers: StickerView[];
  coupons: { id: string; title: string; used: boolean }[];
  /** 오늘의 문제(정답은 들어 있지 않음). 문제가 없으면 null */
  quiz?: { id: string; question: string; kind: "choice" | "short"; options: string[] | null; solved: boolean } | null;
  lastSticker?: { id: string; slot: number; kind: "routine" | "bonus"; role: Role | null; note?: string | null } | null;
};

export type Celebration = {
  id: number;
  type: "sticker" | "bonus" | "coupon";
  role: Role;
  note?: string | null;
  slot: number;
  /** 쿠폰 완성이 보너스 스티커로 이뤄졌는지 */
  bonus?: boolean;
};
