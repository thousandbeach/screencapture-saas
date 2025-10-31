import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { PreviewAuth } from "@/components/auth/PreviewAuth";

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
      <body>
        <PreviewAuth>
          <AuthProvider>{children}</AuthProvider>
        </PreviewAuth>
      </body>
    </html>
  );
}