import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "VANTA — Cyber Intelligence Platform",
  description: "Güvenlik ekipleri için siber tehdit istihbaratı, saldırı yüzeyi analizi ve AI destekli güvenlik operasyonları. VANTA ile güvenlik ihtiyacınızı değerlendirin.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}