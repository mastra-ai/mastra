/**
 * Linear identity capability for the standalone integration.
 *
 * Runs a GraphQL `users` query against `api.linear.app/graphql` using the
 * OAuth access token stored on the org's Linear connection. Filters out
 * guest accounts and anyone the workspace has deactivated so the roster
 * only surfaces plausible `@me` candidates for the acting user's teammates.
 *
 * A missing or disconnected Linear connection returns an empty list rather
 * than throwing — the identity dropdown should degrade to "nothing to
 * claim yet" instead of blocking every other integration's rows behind
 * one integration's failure.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';

interface LinearUserNode {
  id: string;
  guest?: boolean | null;
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface LinearUsersConnection {
  users: {
    nodes: LinearUserNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// Linear's UserFilter does not expose `guest`, so the query filters on
// `active` only and guests are dropped locally from each page's nodes.
const LINEAR_USERS_QUERY = /* GraphQL */ `
  query FactoryIdentityLinearUsers($first: Int!, $after: String) {
    users(first: $first, after: $after, filter: { active: { eq: true } }) {
      nodes {
        id
        guest
        name
        displayName
        email
        avatarUrl
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * The narrow slice of the standalone Linear integration the identity
 * capability consults. Passing this shape rather than the full class keeps
 * the identity module easy to test with a fake — the roster fetch is the
 * whole surface area we care about.
 */
export interface LinearIdentityHost {
  loadConnection(orgId: string): Promise<{ workspaceUrlKey?: string | null } | null>;
  getFreshAccessToken(connection: { workspaceUrlKey?: string | null }): Promise<string>;
  /** Same GraphQL POST helper the rest of the integration uses. */
  linearGraphql<T>(accessToken: string, query: string, variables?: Record<string, unknown>): Promise<T>;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  if (account.email && account.email.toLowerCase().includes(needle)) return true;
  return false;
}

export function buildLinearIdentity(host: LinearIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId, query }) {
      // loadConnection reads storage, which throws before initialize() runs
      // or on a storage error — keep it inside the fail-soft contract.
      let connection: { workspaceUrlKey?: string | null } | null;
      try {
        connection = await host.loadConnection(orgId);
      } catch {
        return [];
      }
      if (!connection) return [];
      let accessToken: string;
      try {
        accessToken = await host.getFreshAccessToken(connection);
      } catch {
        return [];
      }

      const collected: IntegrationCandidateAccount[] = [];
      let after: string | null = null;
      const workspace = connection.workspaceUrlKey ?? undefined;
      // Cap iterations at 20 pages (2000 users) — larger Linear workspaces
      // exist but we do not want a single stalled request to hang the whole
      // identity dropdown.
      for (let page = 0; page < 20; page++) {
        let response: LinearUsersConnection;
        try {
          response = await host.linearGraphql<LinearUsersConnection>(accessToken, LINEAR_USERS_QUERY, {
            first: 100,
            after,
          });
        } catch {
          break;
        }
        for (const node of response.users.nodes) {
          if (node.guest) continue;
          const label = node.displayName ?? node.name ?? node.id;
          collected.push({
            externalUserId: node.id,
            label,
            ...(node.email ? { email: node.email } : {}),
            ...(node.avatarUrl ? { avatarUrl: node.avatarUrl } : {}),
            ...(workspace ? { installation: workspace } : {}),
          });
        }
        if (!response.users.pageInfo.hasNextPage) break;
        after = response.users.pageInfo.endCursor ?? null;
        if (!after) break;
      }
      return collected.filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
