import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { useAdminClient } from '@/hooks/use-admin-client';

export function InviteAcceptPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const adminClient = useAdminClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/invite/${inviteId}`);
      return;
    }

    const acceptInvite = async () => {
      if (!inviteId) return;

      setLoading(true);
      try {
        const result = await adminClient.invites.accept(inviteId);
        navigate(`/teams/${result.team.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to accept invite');
      } finally {
        setLoading(false);
      }
    };

    acceptInvite();
  }, [inviteId, isAuthenticated, authLoading, navigate, adminClient]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1 mx-auto mb-4" />
          <p className="text-neutral6">Accepting invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface1">
        <div className="w-full max-w-md p-8 bg-surface2 rounded-lg border border-border text-center">
          <h1 className="text-2xl font-semibold text-neutral9 mb-4">Unable to accept invite</h1>
          <p className="text-red-500 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-accent1 text-white rounded-md hover:bg-accent2">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
