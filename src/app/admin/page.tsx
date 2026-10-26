import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "ADMIN · 스티커 친구", robots: { index: false } };

export default function AdminPage() {
  return <AdminApp />;
}
