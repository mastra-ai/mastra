import type { MastraAdmin, User } from '@mastra/admin';
import type { Context, Next } from 'hono';

/**
 * Auth middleware configuration.
 */
export interface AuthMiddlewareConfig {
  /**
   * Paths that don't require authentication.
   * Supports pattern matching with :param placeholders.
   */
  publicPaths?: string[];

  /**
   * Custom token extraction function.
   * Default: extracts from Authorization header, query param, or cookie.
   */
  extractToken?: (c: Context) => string | null;
}

/**
 * Default public paths that don't require authentication.
 */
const DEFAULT_PUBLIC_PATHS = ['/health', '/ready', '/auth/login', '/auth/refresh', '/invites/:inviteId/accept'];

/**
 * Extract token from request using default strategy.
 * Checks: Authorization header, query param, cookie.
 */
function extractDefaultToken(c: Context): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query param (useful for WebSocket connections)
  const queryToken = c.req.query('token');
  if (queryToken) {
    return queryToken;
  }

  // Check cookie
  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if a path matches a pattern (supports :param placeholders).
 */
function pathMatchesPattern(path: string, pattern: string): boolean {
  // Convert pattern to regex (handles :param placeholders)
  const regexPattern = pattern.replace(/:[^/]+/g, '[^/]+');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Check if a path is in the public paths list.
 */
function isPublicPath(path: string, publicPaths: string[]): boolean {
  return publicPaths.some(pattern => pathMatchesPattern(path, pattern));
}

/**
 * Create authentication middleware.
 *
 * This middleware:
 * 1. Skips authentication for public paths
 * 2. Extracts token from request
 * 3. Validates token via MastraAdmin's auth provider
 * 4. Sets user and userId in context
 *
 * @example
 * ```typescript
 * const authMiddleware = createAuthMiddleware(admin);
 * app.use('/api/*', authMiddleware);
 * ```
 */
export function createAuthMiddleware(admin: MastraAdmin, config?: AuthMiddlewareConfig) {
  const publicPaths = config?.publicPaths ?? DEFAULT_PUBLIC_PATHS;
  const extractToken = config?.extractToken ?? extractDefaultToken;

  return async (c: Context, next: Next) => {
    const path = c.req.path;
    const basePath = (c.get('basePath') as string | undefined) ?? '/api';

    // Get the relative path (strip base path)
    const relativePath = path.startsWith(basePath) ? path.substring(basePath.length) : path;

    // Check if path is public (skip auth)
    if (isPublicPath(relativePath, publicPaths) || isPublicPath(path, publicPaths)) {
      return next();
    }

    // Extract token
    const token = extractToken(c);

    if (!token) {
      return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401);
    }

    // Get auth provider
    const auth = admin.getAuth();
    if (!auth || !auth.validateToken) {
      // No auth provider configured, skip validation
      // This is useful for development/testing
      return next();
    }

    try {
      // Validate token
      const result = await auth.validateToken(token);

      if (!result) {
        return c.json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' }, 401);
      }

      // Get full user info if available
      let user: User | null = null;
      if (auth.getUser) {
        const authUser = await auth.getUser(result.userId);
        if (authUser) {
          user = {
            id: authUser.id,
            email: authUser.email ?? '',
            name: authUser.name ?? null,
            avatarUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      }

      // Set user in context
      c.set('user', user);
      c.set('userId', result.userId);

      return next();
    } catch (error) {
      console.error('Authentication error:', error);
      return c.json({ error: 'Authentication failed', code: 'UNAUTHORIZED' }, 401);
    }
  };
}
