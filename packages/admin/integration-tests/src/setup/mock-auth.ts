import type { AdminAuthProvider } from '@mastra/admin';

interface MockUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Simple mock auth provider for integration tests.
 *
 * This provider allows any token that starts with 'test-' and extracts
 * the userId from it. This makes it easy to simulate authenticated
 * requests in tests without setting up real authentication.
 *
 * @example
 * ```typescript
 * const mockAuth = new MockAuthProvider();
 *
 * // Register a user for testing
 * mockAuth.registerUser({
 *   id: 'user-123',
 *   email: 'test@example.com',
 *   name: 'Test User',
 * });
 *
 * // Create a token for the user
 * const token = mockAuth.createToken('user-123'); // Returns 'test-user-123'
 *
 * // Validate the token
 * const result = await mockAuth.validateToken(token);
 * // result: { userId: 'user-123' }
 * ```
 */
export class MockAuthProvider implements AdminAuthProvider {
  private users = new Map<string, MockUser>();

  /**
   * Register a user for testing.
   */
  registerUser(user: MockUser): void {
    this.users.set(user.id, user);
  }

  /**
   * Register multiple users for testing.
   */
  registerUsers(users: MockUser[]): void {
    for (const user of users) {
      this.registerUser(user);
    }
  }

  /**
   * Clear all registered users.
   */
  clear(): void {
    this.users.clear();
  }

  /**
   * Validate token format: 'test-{userId}'
   *
   * @param token The token to validate
   * @returns The userId if valid, null otherwise
   */
  async validateToken(token: string): Promise<{ userId: string } | null> {
    if (!token.startsWith('test-')) {
      return null;
    }

    const userId = token.replace('test-', '');
    if (this.users.has(userId)) {
      return { userId };
    }

    return null;
  }

  /**
   * Get user by ID.
   *
   * @param userId The user ID to look up
   * @returns The user if found, null otherwise
   */
  async getUser(userId: string): Promise<MockUser | null> {
    return this.users.get(userId) ?? null;
  }

  /**
   * Create a token for a user (test helper).
   *
   * @param userId The user ID to create a token for
   * @returns The token string
   */
  createToken(userId: string): string {
    return `test-${userId}`;
  }

  /**
   * Check if a user is registered.
   *
   * @param userId The user ID to check
   * @returns True if the user is registered
   */
  hasUser(userId: string): boolean {
    return this.users.has(userId);
  }

  /**
   * Get all registered users (for debugging).
   *
   * @returns Array of all registered users
   */
  getAllUsers(): MockUser[] {
    return Array.from(this.users.values());
  }
}
