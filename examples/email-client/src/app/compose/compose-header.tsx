import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-md mb-6">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          Email Client
        </Link>
        <nav>
          <Link href="/emails" className="text-gray-600 hover:text-blue-600 transition duration-300">
            Back to Inbox
          </Link>
        </nav>
      </div>
    </header>
  );
}
