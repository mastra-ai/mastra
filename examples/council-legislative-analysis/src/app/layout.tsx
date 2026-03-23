import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Legislative Council — Multi-Agent Policy Analysis',
  description: 'Council pattern: six expert committees analyze legislation in parallel, then a synthesizer produces a unified report',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-cream text-zinc-800 antialiased">{children}</body>
    </html>
  );
}
