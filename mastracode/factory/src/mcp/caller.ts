import type { MastraAuthWorkos } from '@mastra/auth-workos';
import type { McpCaller } from './token.js';

type WorkOS = ReturnType<MastraAuthWorkos['getWorkOS']>;

/**
 * Looks up the person a verified token names, acting in the org it was granted
 * for. `null` when they no longer belong to that org (or no longer exist);
 * throws when the lookup itself fails.
 */
export type McpCallerResolver = (caller: { userId: string; orgId: string }) => Promise<McpCaller | null>;

type UserManagement = Pick<WorkOS['userManagement'], 'getUser' | 'listOrganizationMemberships'>;

/**
 * Resolves MCP callers against WorkOS on every request, so removing someone
 * from an org ends their MCP access at once rather than when the token expires,
 * and audit entries carry their name.
 */
export function createWorkosMcpCallerResolver(userManagement: UserManagement): McpCallerResolver {
  return async ({ userId, orgId }) => {
    let user;
    let memberships;
    try {
      [user, memberships] = await Promise.all([
        userManagement.getUser(userId),
        userManagement.listOrganizationMemberships({ userId, organizationId: orgId, statuses: ['active'] }),
      ]);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
    if (!memberships.data.some(membership => membership.organizationId === orgId)) return null;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return {
      userId: user.id,
      orgId,
      profile: {
        ...(name ? { name } : {}),
        ...(user.email ? { email: user.email } : {}),
        ...(user.profilePictureUrl ? { avatarUrl: user.profilePictureUrl } : {}),
      },
    };
  };
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404;
}
