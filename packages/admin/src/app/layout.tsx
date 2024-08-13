import { Inter } from 'next/font/google';

import { getConfig } from '../lib/get-configuration';

import './globals.css';
import AdminLayout from './layouts/admin-layout';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const integrations = await getConfig().then(res => res.integrations);
  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        <AdminLayout integrations={integrations}>{children}</AdminLayout>
      </body>
    </html>
  );
}
