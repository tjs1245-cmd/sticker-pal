import type { Metadata } from "next";
import DemoKid from "@/components/kid/DemoKid";

export const metadata: Metadata = { title: "스티커 친구 · 데모" };

export default function DemoPage() {
  return <DemoKid />;
}
