import Link from "next/link";

export default function ComingSoon({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-7xl">🚧</div>
      <h1 className="text-3xl">{title}</h1>
      <p className="text-lg opacity-80">{children ?? "다음 단계에서 만들 화면이에요. 지금은 데모 모드를 체험해 보세요!"}</p>
      <div className="flex gap-3">
        <Link href="/" className="rounded-full bg-white px-5 py-2 text-lg shadow">
          처음으로
        </Link>
        <Link href="/kid/demo" className="rounded-full bg-pink-400 px-5 py-2 text-lg text-white shadow">
          데모 보기
        </Link>
      </div>
    </main>
  );
}
