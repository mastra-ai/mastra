import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mastra Next.js Template',
  description: 'A starter template for Next.js with Mastra AI integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-gray-50 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <header className="mb-8">
              <h1 className="text-2xl font-bold text-gray-800">Mastra + Next.js</h1>
              <p className="text-gray-600">AI-powered weather information</p>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
