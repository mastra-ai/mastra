import { useAdminClientContext } from '@/providers/admin-client-provider';

export function useAdminClient() {
  return useAdminClientContext();
}
