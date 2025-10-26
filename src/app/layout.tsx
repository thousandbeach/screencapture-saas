import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScreenCapture SaaS - Webサイトスクリーンショット取得サービス",
  description: "最大300ページのマルチデバイススクリーンショットを無料で取得",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}