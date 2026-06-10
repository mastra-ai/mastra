/**
 * User provider interface for authentication.
 * Enables user awareness in Studio.
 */

/**
 * Base user type for authentication.
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email?: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Provider interface for user awareness in Studio.
 *
 * Implement this interface to enable:
 * - Current user display in header
 * - User menu with profile info
 * - User context in API calls
 *
 * @example
 * ```typescript
 * class MyUserProvider implements IUserProvider {
 *   async getCurrentUser(request: Request) {
 *     const session = await this.getSession(request);
 *     if (!session) return null;
 *     return this.db.getUser(session.userId);
 *   }
 *
 *   async getUser(userId: string) {
 *     return this.db.getUser(userId);
 *   }
 * }
 * ```
 */
export interface IUserProvider<TUser extends User = User> {
  /**
   * Get current user from request (session cookie, token, etc.)
   *
   * @param request - Incoming HTTP request
   * @returns User object or null if not authenticated
   */
  getCurrentUser(request: Request): Promise<TUser | null>;

  /**
   * Get user by ID.
   *
   * @param userId - User identifier
   * @returns User object or null if not found
   */
  getUser(userId: string): Promise<TUser | null>;

  /**
   * Optional: Get multiple users by ID in a single call.
   *
   * Returns results positionally aligned to `userIds`, with `null` for any
   * user that could not be resolved. Providers that can perform a single
   * batched lookup (e.g. a DB-backed provider) should implement this to
   * avoid N round trips when callers (such as author enrichment on list
   * endpoints) need many users at once. If not implemented, callers should
   * fall back to `Promise.all(userIds.map(id => getUser(id)))`.
   *
   * @param userIds - List of user identifiers
   * @returns Array of user objects (or `null` per missing entry) in input order
   */
  getUsers?(userIds: string[]): Promise<Array<TUser | null>>;

  /**
   * Optional: Get URL to user's profile page.
   *
   * @param user - User object
   * @returns URL string to profile
   */
  getUserProfileUrl?(user: TUser): string;
}

/**
 * Options for listing users.
 */
export interface ListUsersOptions {
  /** Search query to filter users by name or email */
  search?: string;
  /** Maximum number of users to return */
  limit?: number;
  /** Number of users to skip (for pagination) */
  offset?: number;
  /** Filter by role */
  role?: string;
  /** Filter by organization ID (for listing org members vs all users) */
  organizationId?: string;
}

/**
 * Result of listing users.
 */
export interface ListUsersResult<TUser extends User = User> {
  /** Array of users matching the query */
  users: TUser[];
  /** Total count of users (for pagination) */
  total: number;
}

/**
 * Provider interface for listing users.
 *
 * Implement this interface to enable:
 * - Team member listing in Studio (for internal users via studioAuth)
 * - Customer listing in Studio (for external users via server auth)
 * - User search and filtering
 * - Paginated user views
 *
 * This interface is separate from IUserProvider because not all auth providers
 * support listing users (e.g., simple JWT validation doesn't have user storage).
 *
 * @example
 * ```typescript
 * class WorkOSUserListing implements IUserListing<WorkOSUser> {
 *   async listUsers(options?: ListUsersOptions) {
 *     const response = await this.workos.userManagement.listUsers({
 *       limit: options?.limit ?? 20,
 *       after: options?.offset ? String(options.offset) : undefined,
 *     });
 *     return {
 *       users: response.data.map(this.mapUser),
 *       total: response.listMetadata.count,
 *     };
 *   }
 * }
 * ```
 */
export interface IUserListing<TUser extends User = User> {
  /**
   * List users with optional filtering and pagination.
   *
   * @param options - Optional filtering and pagination options
   * @returns Paginated list of users with total count
   */
  listUsers(options?: ListUsersOptions): Promise<ListUsersResult<TUser>>;
}
