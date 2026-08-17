import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Mastra on the Workflow SDK',
  description: 'Mastra workflows running as durable Vercel Workflow SDK runs',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '2rem 1.5rem',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          lineHeight: 1.5,
        }}
      >
        <main style={{ maxWidth: '48rem', margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
