import { Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

import 'react-day-picker/style.css';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--jetbrains-mono',
});

const tasaExplorer = localFont({
  src: './fonts/TASAExplorerVF.woff2',
  display: 'swap',
  variable: '--tasa-explorer',
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`dark ${inter.className} ${tasaExplorer.variable} ${jetbrainsMono.variable}`}>
        <Toaster position="bottom-right" />
        <TooltipProvider> {children}</TooltipProvider>
      </body>
    </html>
  );
}
