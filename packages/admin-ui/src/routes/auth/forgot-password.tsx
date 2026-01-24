import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface1">
        <div className="w-full max-w-md p-8 bg-surface2 rounded-lg border border-border">
          <h1 className="text-2xl font-semibold text-neutral9 mb-4">Check your email</h1>
          <p className="text-neutral6 mb-6">
            We&apos;ve sent a password reset link to <strong>{email}</strong>
          </p>
          <Link to="/login" className="block w-full text-center py-2 bg-accent1 text-white rounded-md hover:bg-accent2">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface1">
      <div className="w-full max-w-md p-8 bg-surface2 rounded-lg border border-border">
        <h1 className="text-2xl font-semibold text-neutral9 mb-2">Reset password</h1>
        <p className="text-neutral6 mb-6">Enter your email and we&apos;ll send you a reset link.</p>

        {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-neutral6 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-accent1 text-white rounded-md hover:bg-accent2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral6">
          Remember your password?{' '}
          <Link to="/login" className="text-accent1 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
