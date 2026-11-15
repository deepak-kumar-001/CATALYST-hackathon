import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareCircle · calm care, connected",
  description: "A private care relay for elders, caretakers and trusted family.",
  icons: { icon: "https://cdn.simpleicons.org/heart/0F766E" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
