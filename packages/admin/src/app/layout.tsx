import { Inter } from 'next/font/google';

import { future } from '../../example.future.config';

import './globals.css';
import AdminLayout from './layouts/admin-layout';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const integrations = future.availablePlugins();

  return (
    <html lang="en">
      <body className={`dark ${inter.className}`}>
        <AdminLayout integrations={integrations}>{children}</AdminLayout>
      </body>
    </html>
  );
}
