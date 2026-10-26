import type { Metadata } from "next";
import ParentApp from "@/components/parent/ParentApp";

export const metadata: Metadata = { title: "부모 화면 · 스티커 친구", robots: { index: false } };

export default function ParentPage() {
  return <ParentApp />;
}
