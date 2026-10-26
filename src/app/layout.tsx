import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import "./globals.css";
import FloatingBg from "@/components/FloatingBg";

const jua = Jua({
  variable: "--font-jua",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "스티커 친구",
  description: "루틴을 지키면 스티커가 쌓이고, 30개를 모으면 장난감 쿠폰!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#bae6fd",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${jua.variable} h-full antialiased`}>
      <body className="font-sans min-h-full flex flex-col">
        <FloatingBg />
        {children}
      </body>
    </html>
  );
}
