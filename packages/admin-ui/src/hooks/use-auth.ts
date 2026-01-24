import { useAuthContext } from '@/providers/auth-provider';

export function useAuth() {
  return useAuthContext();
}
