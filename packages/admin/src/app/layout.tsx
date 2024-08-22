import { Inter } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';

import { getFramework } from '@/lib/framework-utils';

import 'react-day-picker/style.css';

import './globals.css';
import AdminLayout from './layouts/admin-layout';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const framework = await getFramework();
  const integrations = framework?.availableIntegrations() || [];

  return (
    <html lang="en">
      <body className={`dark ${inter.className}`}>
        <Toaster position="bottom-right" />
        <AdminLayout integrations={integrations}>{children}</AdminLayout>
      </body>
    </html>
  );
}
