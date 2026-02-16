import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI SDK v5 — Weather & Client-Side Tools",
  description:
    "Mastra example: server-side and client-side tools using AI SDK v5 useChat + addToolOutput",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
