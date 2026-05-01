import { useAuthCapabilities } from './use-auth-capabilities';

/**
 * Returns the default visibility for new entities based on auth state.
 * When auth is enabled, new items default to 'private' (owned by the creator).
 * When auth is disabled, everything is 'public' (no ownership concept).
 */
export function useDefaultVisibility(): 'private' | 'public' {
  const { data } = useAuthCapabilities();
  return data?.enabled ? 'private' : 'public';
}
