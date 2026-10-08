import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import PwaRegister from "@/components/Pwaregister";
import Providers from "./providers";
// @ts-ignore
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Photo Frame",
  description: "Turn any photo into a printed-style card with camera details.",
  appleWebApp: { capable: true, title: "Photo Frame", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`light ${inter.variable}`}>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}