/**
 * User provider interface for EE authentication.
 * Enables user awareness in Studio.
 */

/**
 * Base user type for EE authentication.
 */
export interface EEUser {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email?: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
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
export interface IUserProvider<TUser extends EEUser = EEUser> {
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
   * Optional: Get URL to user's profile page.
   *
   * @param user - User object
   * @returns URL string to profile
   */
  getUserProfileUrl?(user: TUser): string;
}
