import { createClerkClient } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';
import { verifyJwks } from '@mastra/auth';
import type { JwtPayload } from '@mastra/auth';
import type { IUserProvider } from '@mastra/core/auth';
import type { EEUser } from '@mastra/core/auth/ee';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

type ClerkUser = JwtPayload;

interface MastraAuthClerkOptions extends MastraAuthProviderOptions<ClerkUser> {
  jwksUri?: string;
  secretKey?: string;
  publishableKey?: string;
}

export class MastraAuthClerk extends MastraAuthProvider<ClerkUser> implements IUserProvider<EEUser> {
  protected clerk: ClerkClient;
  protected jwksUri: string;

  constructor(options?: MastraAuthClerkOptions) {
    super({ name: options?.name ?? 'clerk' });

    const jwksUri = options?.jwksUri ?? process.env.CLERK_JWKS_URI;
    const secretKey = options?.secretKey ?? process.env.CLERK_SECRET_KEY;
    const publishableKey = options?.publishableKey ?? process.env.CLERK_PUBLISHABLE_KEY;

    if (!jwksUri || !secretKey || !publishableKey) {
      throw new Error(
        'Clerk JWKS URI, secret key and publishable key are required, please provide them in the options or set the environment variables CLERK_JWKS_URI, CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY',
      );
    }

    this.jwksUri = jwksUri;
    this.clerk = createClerkClient({
      secretKey,
      publishableKey,
    });

    this.registerOptions(options);
  }

  async authenticateToken(token: string): Promise<ClerkUser | null> {
    const user = await verifyJwks(token, this.jwksUri);
    return user;
  }

  async authorizeUser(user: ClerkUser) {
    return !!user.sub;
  }

  /**
   * Extract the bearer token from the request's Authorization header or cookie.
   */
  private extractToken(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) return token;
    }

    const cookie = request.headers.get('Cookie');
    if (cookie) {
      // Clerk's default session cookie is __session
      const match = cookie.match(/__session=([^;]+)/);
      if (match?.[1]) return match[1];
    }

    return null;
  }

  async getCurrentUser(request: Request): Promise<EEUser | null> {
    const token = this.extractToken(request);
    if (!token) return null;

    try {
      const payload = await this.authenticateToken(token);
      if (!payload?.sub) return null;

      // Try to fetch full user details from Clerk API
      try {
        const clerkUser = await this.clerk.users.getUser(payload.sub);
        return {
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress,
          name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || undefined,
          avatarUrl: clerkUser.imageUrl,
          metadata: clerkUser.publicMetadata as Record<string, unknown> | undefined,
        };
      } catch {
        // Fall back to JWT claims if Clerk API call fails
        return {
          id: payload.sub,
          email: (payload.email as string) ?? undefined,
          name: (payload.name as string) ?? undefined,
        };
      }
    } catch {
      return null;
    }
  }

  async getUser(userId: string): Promise<EEUser | null> {
    try {
      const clerkUser = await this.clerk.users.getUser(userId);
      return {
        id: clerkUser.id,
        email: clerkUser.emailAddresses?.[0]?.emailAddress,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || undefined,
        avatarUrl: clerkUser.imageUrl,
        metadata: clerkUser.publicMetadata as Record<string, unknown> | undefined,
      };
    } catch {
      return null;
    }
  }

  getUserProfileUrl(user: EEUser): string {
    return `/user/${user.id}`;
  }
}
