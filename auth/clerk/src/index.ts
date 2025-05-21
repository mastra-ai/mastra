import { createClerkClient } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';
import { verifyJwks } from '@mastra/auth';
import type { JwtPayload } from '@mastra/auth';
import { MastraAuthProvider } from '@mastra/core/server';

interface MastraAuthClerkOptions {
  jwksUri?: string;
  secretKey?: string;
  publishableKey?: string;
}

type ClerkUser = JwtPayload;

export class MastraAuthClerk extends MastraAuthProvider<ClerkUser> {
  protected clerk: ClerkClient;
  protected jwksUri: string;

  constructor(options?: MastraAuthClerkOptions) {
    super({ name: 'supabase' });

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
  }

  async authenticateToken(token: string): Promise<ClerkUser | null> {
    const user = await verifyJwks(token, this.jwksUri);
    return user;
  }

  async authorizeUser(user: ClerkUser) {
    if (!user.sub) {
      return false;
    }

    const orgs = await this.clerk.users.getOrganizationMembershipList({
      userId: user.sub,
    });

    return orgs.data.length > 0;
  }
}
