import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface1">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-neutral9 mb-4">404</h1>
        <p className="text-xl text-neutral6 mb-8">Page not found</p>
        <Link to="/" className="px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2">
          Go Home
        </Link>
      </div>
    </div>
  );
}
