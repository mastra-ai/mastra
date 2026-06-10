import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { fetchWithRefresh } from './fetch-with-refresh';

/**
 * User object returned from the server users API
 */
export type User = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  lastActiveAt?: string;
  createdAt?: string;
  role?: string;
};

/**
 * Response from the users list API
 */
export type UsersListResponse = {
  users: User[];
  total: number;
};

/**
 * Options for fetching users
 */
export type UseUsersOptions = {
  /** Search query to filter users by name or email */
  search?: string;
  /** Maximum number of users to return */
  limit?: number;
  /** Number of users to skip for pagination */
  offset?: number;
  /** Filter users by role */
  role?: string;
  /** Whether the query is enabled */
  enabled?: boolean;
};

/**
 * Hook to fetch a list of server users (external customers).
 *
 * Returns paginated list of users from the server auth provider.
 * Requires the auth provider to implement IUserListing.
 *
 * @example
 * ```tsx
 * import { useUsers } from '@/domains/auth/hooks/use-users';
 *
 * function UsersList() {
 *   const { data, isLoading } = useUsers({ limit: 20 });
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return (
 *     <ul>
 *       {data?.users.map(user => (
 *         <li key={user.id}>{user.name || user.email}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useUsers(options: UseUsersOptions = {}) {
  const { search, limit = 50, offset = 0, role, enabled = true } = options;
  const client = useMastraClient();
  const baseUrl = client.options?.baseUrl || '';

  return useQuery<UsersListResponse>({
    queryKey: ['auth', 'users', { search, limit, offset, role }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (limit) params.set('limit', String(limit));
      if (offset) params.set('offset', String(offset));
      if (role) params.set('role', role);

      const url = `${baseUrl}/api/auth/users${params.toString() ? `?${params}` : ''}`;
      const response = await fetchWithRefresh(baseUrl, url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      return response.json();
    },
    enabled,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}

/**
 * Hook to fetch a single user by ID.
 *
 * Returns user details including name, email, avatar, and activity timestamps.
 * Requires the auth provider to implement IUserProvider.
 *
 * @example
 * ```tsx
 * import { useUser } from '@/domains/auth/hooks/use-users';
 *
 * function UserDetail({ userId }: { userId: string }) {
 *   const { data: user, isLoading } = useUser(userId);
 *
 *   if (isLoading) return <Skeleton />;
 *   if (!user) return <div>User not found</div>;
 *
 *   return (
 *     <div>
 *       <Avatar src={user.avatarUrl} />
 *       <h1>{user.name || user.email}</h1>
 *       <p>Last active: {user.lastActiveAt}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUser(userId: string | undefined, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const client = useMastraClient();
  const baseUrl = client.options?.baseUrl || '';

  return useQuery<User | null>({
    queryKey: ['auth', 'user', userId],
    queryFn: async () => {
      if (!userId) return null;

      const response = await fetchWithRefresh(baseUrl, `${baseUrl}/api/auth/users/${userId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-mastra-client-type': 'studio',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch user: ${response.status}`);
      }

      return response.json();
    },
    enabled: enabled && !!userId,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}
