"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { errorMessage, post } from "@/lib/apiClient";
import { ui } from "./ui";
import type { FamilyData, Kid } from "./useFamily";

const AVATARS = ["🐻", "🐰", "🐶", "🐱", "🦊", "🐼", "🦁", "🐸", "🦄", "🐯"];
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // I, L, O, 0, 1 제외
const CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export default function SettingsTab({
  data,
  refresh,
  onLoggedOut,
}: {
  data: FamilyData;
  refresh: () => Promise<void>;
  onLoggedOut: () => void;
}) {
  const [msg, setMsg] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {msg && (
        <p role="status" className="rounded-xl bg-violet-100 px-3 py-2">
          {msg}
        </p>
      )}
      {data.kids.map((k) => (
        <KidSettings key={k.id} kid={k} refresh={refresh} onMsg={setMsg} />
      ))}
      <AddKid count={data.kids.length} refresh={refresh} onMsg={setMsg} />
      <Password onMsg={setMsg} />
      <button
        type="button"
        onClick={async () => {
          await post("/api/parent", { action: "logout" });
          onLoggedOut();
        }}
        className={ui.ghost}
      >
        로그아웃
      </button>
    </div>
  );
}

function KidSettings({ kid, refresh, onMsg }: { kid: Kid; refresh: () => Promise<void>; onMsg: (m: string) => void }) {
  const [name, setName] = useState(kid.name);
  const [avatar, setAvatar] = useState(kid.avatar);
  const [code, setCode] = useState(kid.view_token);
  const [qr, setQr] = useState("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${window.location.origin}/kid/${kid.view_token}`, { margin: 1, width: 192 }).then((u) => {
      if (alive) setQr(u);
    });
    return () => {
      alive = false;
    };
  }, [kid.view_token]);

  async function save() {
    const c = code.trim().toUpperCase();
    if (!name.trim()) return onMsg("이름을 입력해 주세요.");
    if (!CODE_RE.test(c)) return onMsg("코드는 6자(영문 대문자/숫자, I·L·O·0·1 제외)예요.");
    const r = await post("/api/parent", { action: "updateKid", id: kid.id, name: name.trim(), avatar, code: c });
    if (!r.ok) onMsg(r.error === "duplicate" ? "이미 쓰고 있는 코드예요. 다른 코드를 써 주세요." : errorMessage(r.error));
    else {
      onMsg("저장했어요.");
      setCode(c);
      await refresh();
    }
  }

  return (
    <section className={`${ui.card} flex flex-col gap-3`}>
      <h2 className="text-xl">
        {avatar} {kid.name}
      </h2>
      <label className="flex flex-col gap-1">
        이름
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className={ui.input} />
      </label>
      <div>
        <p className="mb-1">아바타</p>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              onClick={() => setAvatar(a)}
              className={`grid h-12 w-12 place-items-center rounded-full text-3xl shadow ${avatar === a ? "bg-violet-200 ring-4 ring-violet-400" : "bg-white"}`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1">아이 코드</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            maxLength={6}
            className={`${ui.input} text-center tracking-[0.3em]`}
            aria-label="아이 코드"
          />
          <button type="button" onClick={() => setCode(randomCode())} className={ui.ghost}>
            🎲 새 코드
          </button>
        </div>
        <p className="mt-1 text-sm opacity-70">코드를 바꾸면 예전 코드로는 들어갈 수 없어요.</p>
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`${kid.name} 화면 QR 코드`} width={192} height={192} className="self-center rounded-xl bg-white p-2 shadow" />
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} className={`${ui.primary} flex-1`}>
          저장
        </button>
        <Link href={`/kid/${kid.view_token}`} className={ui.ghost}>
          아이 화면 보기
        </Link>
      </div>
    </section>
  );
}

function AddKid({ count, refresh, onMsg }: { count: number; refresh: () => Promise<void>; onMsg: (m: string) => void }) {
  const [name, setName] = useState("");
  if (count >= 2)
    return <p className={`${ui.card} text-center opacity-70`}>아이는 가족당 최대 2명까지 등록할 수 있어요.</p>;
  return (
    <form
      className={`${ui.card} flex flex-col gap-2`}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await post("/api/parent", { action: "addKid", name });
        onMsg(r.ok ? "아이를 추가했어요. 기본 루틴 3개가 만들어졌어요." : errorMessage(r.error));
        if (r.ok) {
          setName("");
          await refresh();
        }
      }}
    >
      <h2 className="text-xl">아이 추가</h2>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="아이 이름" className={ui.input} />
        <button type="submit" disabled={!name.trim()} className={ui.primary}>
          추가
        </button>
      </div>
    </form>
  );
}

function Password({ onMsg }: { onMsg: (m: string) => void }) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  return (
    <form
      className={`${ui.card} flex flex-col gap-2`}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await post("/api/parent", { action: "changePassword", current: cur, next: pw });
        onMsg(r.ok ? "비밀번호를 바꿨어요." : errorMessage(r.error));
        if (r.ok) {
          setPw("");
          setCur("");
        }
      }}
    >
      <h2 className="text-xl">내 비밀번호 변경</h2>
      <input
        type="password"
        value={cur}
        onChange={(e) => setCur(e.target.value)}
        placeholder="현재 비밀번호"
        autoComplete="current-password"
        className={ui.input}
      />
      <div className="flex gap-2">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="새 비밀번호 (6자 이상)"
          autoComplete="new-password"
          className={ui.input}
        />
        <button type="submit" disabled={pw.length < 6 || !cur} className={ui.primary}>
          변경
        </button>
      </div>
    </form>
  );
}

