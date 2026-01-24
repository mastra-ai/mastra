import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuthContext } from './auth-provider';
import { ADMIN_API_URL } from '@/lib/constants';

// Placeholder AdminClient - will be fully implemented in Phase 2
interface Team {
  id: string;
  name: string;
  slug: string;
}

interface AdminClient {
  invites: {
    accept: (inviteId: string) => Promise<{ team: Team }>;
  };
}

function createAdminClient(getToken: () => Promise<string | null>): AdminClient {
  const request = async <T,>(method: string, path: string, options?: { body?: unknown }): Promise<T> => {
    const token = await getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${ADMIN_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  };

  return {
    invites: {
      accept: (inviteId: string) => request<{ team: Team }>('POST', `/invites/${inviteId}/accept`),
    },
  };
}

const AdminClientContext = createContext<AdminClient | null>(null);

export function AdminClientProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthContext();

  const client = useMemo(() => {
    return createAdminClient(async () => session?.access_token ?? null);
  }, [session?.access_token]);

  return <AdminClientContext.Provider value={client}>{children}</AdminClientContext.Provider>;
}

export function useAdminClientContext(): AdminClient {
  const client = useContext(AdminClientContext);
  if (!client) {
    throw new Error('useAdminClientContext must be used within AdminClientProvider');
  }
  return client;
}
