import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "福栄 取引先データ管理",
  description: "取引先ごとの情報・ルール・注意事項の一元管理",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <StoreProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
