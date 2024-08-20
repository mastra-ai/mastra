import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';

import 'react-day-picker/style.css';

import { future } from '../../example.future.config';

import './globals.css';
import AdminLayout from './layouts/admin-layout';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const integrations = future.availableIntegrations();

  return (
    <html lang="en">
      <body className={`dark ${inter.className}`}>
        <Toaster position="bottom-right" />
        <AdminLayout integrations={integrations}>{children}</AdminLayout>
      </body>
    </html>
  );
}
