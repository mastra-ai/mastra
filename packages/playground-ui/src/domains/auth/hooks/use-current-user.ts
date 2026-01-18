import { useAuthCapabilities } from './use-auth-capabilities';
import { isAuthenticated, type AuthenticatedUser } from '../types';

/**
 * Returns the current authenticated user
 * - Returns the user object when authenticated
 * - Returns null when not authenticated
 * - Returns undefined while auth state is loading
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useCurrentUser();
 *
 *   if (user === undefined) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   if (user === null) {
 *     return <div>Not logged in</div>;
 *   }
 *
 *   return <div>Hello, {user.name}!</div>;
 * }
 * ```
 */
export function useCurrentUser(): AuthenticatedUser | null | undefined {
  const { data: capabilities, isLoading } = useAuthCapabilities();

  // Loading state - return undefined
  if (isLoading || !capabilities) {
    return undefined;
  }

  // Check if authenticated and return user
  if (isAuthenticated(capabilities)) {
    return capabilities.user;
  }

  // Not authenticated - return null
  return null;
}
