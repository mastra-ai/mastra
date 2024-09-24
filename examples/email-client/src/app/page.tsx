import Link from 'next/link';

import { framework } from '@/lib/framework-utils';

export default function Home() {
  const oAuthUrl = framework?.makeConnectURI({
    name: 'GOOGLE',
    connectionId: 'user-1',
    clientRedirectPath: '/emails',
  });
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-r from-blue-50 to-purple-50">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Welcome to Email Client</h1>
      <Link
        href={oAuthUrl}
        className="flex items-center space-x-2 bg-[#4285F4] hover:bg-[#3367D6] text-white px-6 py-3 rounded-md transition-all duration-300"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#ffffff"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#ffffff"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#ffffff"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#ffffff"
          />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        <span>Connect with Google</span>
      </Link>
    </main>
  );
}
