import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';

import 'react-day-picker/style.css';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`dark ${inter.className}`}>
        <Toaster position="bottom-right" />
        {children}
      </body>
    </html>
  );
}
