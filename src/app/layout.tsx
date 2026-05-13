import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xiaomi IoT Climate Dashboard",
  description: "A local dashboard for Xiaomi Home climate telemetry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
