import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Audio Streaming to Bedrock',
  description: 'Test application for AWS Nova 2 Sonic voice integration',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>{children}</body>
    </html>
  );
}

