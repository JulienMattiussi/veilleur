import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veilleur",
  description: "Bot de veille technologique Discord",
  icons: { icon: "/logo.jpeg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
