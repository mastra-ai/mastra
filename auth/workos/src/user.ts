/**
 * WorkOS user provider implementation.
 *
 * Implements the IUserProvider interface for retrieving user information
 * from WorkOS User Management API and session data.
 *
 * @module auth-workos/user
 */

import type { IUserProvider, EEUser } from '@mastra/core/ee';
import type { WorkOS, User as WorkOSApiUser } from '@workos-inc/node';
import type { AuthService } from '@workos/authkit-session';

import type { WorkOSUser } from './types.js';
import { mapWorkOSUserToEEUser } from './types.js';

/**
 * WorkOS user provider for retrieving user information.
 *
 * Retrieves user data from:
 * - Current session (via WorkOS AuthKit)
 * - User Management API (for user lookup by ID)
 *
 * @example
 * ```typescript
 * const userProvider = new WorkOSUserProvider(workos, authService);
 * const user = await userProvider.getCurrentUser(request);
 * if (user) {
 *   console.log('Authenticated as:', user.email);
 * }
 * ```
 */
export class WorkOSUserProvider implements IUserProvider<WorkOSUser> {
  constructor(
    private workos: WorkOS,
    private authService: AuthService<Request, Response>,
  ) {}

  /**
   * Get current authenticated user from request.
   *
   * Extracts the session from the request cookie and validates it with WorkOS AuthKit.
   * Returns the user information if the session is valid.
   *
   * @param request - Incoming HTTP request with session cookie
   * @returns WorkOS user or null if not authenticated
   */
  async getCurrentUser(request: Request): Promise<WorkOSUser | null> {
    try {
      // Validate session and extract user from AuthKit
      const { auth } = await this.authService.withAuth(request);

      if (!auth?.user) {
        return null;
      }

      // Map WorkOS API user to WorkOSUser format
      return this.mapToWorkOSUser(auth.user);
    } catch (error) {
      // Session invalid or expired
      return null;
    }
  }

  /**
   * Get user by ID from WorkOS User Management API.
   *
   * @param userId - WorkOS user ID
   * @returns WorkOS user or null if not found
   */
  async getUser(userId: string): Promise<WorkOSUser | null> {
    try {
      const user = await this.workos.userManagement.getUser(userId);
      return this.mapToWorkOSUser(user);
    } catch (error) {
      // User not found or API error
      return null;
    }
  }

  /**
   * Get URL to user's profile in WorkOS dashboard.
   *
   * @param user - User object
   * @returns URL to WorkOS user profile
   */
  getUserProfileUrl(user: WorkOSUser): string {
    return `https://dashboard.workos.com/users/${user.id}`;
  }

  /**
   * Map WorkOS API user to WorkOSUser format.
   *
   * @private
   * @param user - WorkOS API user object
   * @returns WorkOSUser with all fields mapped
   */
  private mapToWorkOSUser(user: WorkOSApiUser): WorkOSUser {
    const baseUser = mapWorkOSUserToEEUser(user);

    return {
      id: baseUser.id,
      email: baseUser.email,
      name: baseUser.name,
      avatarUrl: baseUser.avatarUrl,
      metadata: baseUser.metadata,
      workos: {
        userId: user.id,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      },
    };
  }
}
