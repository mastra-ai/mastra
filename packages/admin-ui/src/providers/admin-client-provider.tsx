import { createContext, useContext, useMemo, ReactNode } from 'react';
import { AdminClient } from '@/lib/admin-client';
import { useAuthContext } from './auth-provider';
import { ADMIN_API_URL } from '@/lib/constants';

const AdminClientContext = createContext<AdminClient | null>(null);

export function AdminClientProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthContext();

  const client = useMemo(() => {
    return new AdminClient({
      baseUrl: ADMIN_API_URL,
      getToken: async () => session?.access_token ?? null,
    });
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
