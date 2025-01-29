import type { Metadata } from 'next';

import localFont from 'next/font/local';

import { MastraRuntimeProvider } from './MastraRuntimeProvider';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Mastra + Assistant UI Example',
  description: 'An example with Mastra and Assistant UI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MastraRuntimeProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
      </html>
    </MastraRuntimeProvider>
  );
}
