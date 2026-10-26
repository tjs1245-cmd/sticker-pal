import { Suspense } from "react";
import KidLive from "@/components/kid/KidLive";

async function KidByCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <KidLive code={code} />;
}

export default function KidPage({ params }: PageProps<"/kid/[code]">) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-4xl">⭐</div>}>
      <KidByCode params={params} />
    </Suspense>
  );
}
