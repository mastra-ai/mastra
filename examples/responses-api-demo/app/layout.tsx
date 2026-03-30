import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mastra Responses API Playground',
  description: 'A minimal, warm demo for sending stored and streaming Responses API requests through Mastra.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
