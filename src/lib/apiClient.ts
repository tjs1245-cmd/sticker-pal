"use client";

export type ApiResult<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: string };

/** 서버 API(POST)를 부르고, 네트워크 오류도 { ok:false } 로 돌려줍니다. */
export async function post<T = Record<string, unknown>>(url: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: "network" };
  }
}

export function errorMessage(code: string | undefined): string {
  switch (code) {
    case "no_board":
      return "아이가 먼저 스티커판을 골라야 해요.";
    case "board_full":
      return "스티커판이 이미 가득 찼어요.";
    case "not_pending":
      return "이미 처리된 요청이에요.";
    case "kid_limit_reached":
      return "아이는 가족당 최대 2명이에요.";
    case "forbidden":
    case "not_parent":
      return "권한이 없어요.";
    case "duplicate":
      return "이미 쓰고 있는 값이에요. 다른 값을 써 주세요.";
    case "invalid_input":
      return "입력을 다시 확인해 주세요.";
    case "wrong_password":
      return "현재 비밀번호가 맞지 않아요.";
    case "weak_password":
      return "비밀번호는 6자 이상이어야 해요.";
    case "cannot_redo":
      return "오늘 받은 루틴 스티커만 다시 하게 할 수 있어요. '스티커만 빼기'를 써 주세요.";
    case "board_closed":
      return "쿠폰이 나간 지난 판의 스티커는 뺄 수 없어요.";
    case "not_found":
      return "이미 없어진 스티커예요. 화면을 새로고침해 주세요.";
    case "locked":
      return "지금은 바꿀 수 없어요.";
    case "network":
      return "서버에 연결하지 못했어요.";
    case "not_configured":
      return "DATABASE_URL 이 설정되지 않았어요.";
    default:
      return "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
  }
}
