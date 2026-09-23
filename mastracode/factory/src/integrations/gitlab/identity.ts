/**
 * GitLab identity capability.
 *
 * The user's requested semantics: "list all group/org members". GitLab
 * memberships are hierarchical — a project inherits members from its
 * ancestor group, which inherits from its parent group, and so on. Rather
 * than force operators to configure a specific group id here, we walk the
 * projects the integration already knows about (`activeContexts()` +
 * `listProjects`) and call `GET /projects/:id/members/all`, which returns
 * every user who inherits access from any ancestor group plus the project's
 * own members. Deduplication by GitLab numeric user id then produces a
 * clean union across every project in every configured connection.
 *
 * This is the same view GitLab shows for "@" mention autocomplete on an
 * issue, and it degrades gracefully when a connection is missing or a
 * project's member endpoint returns 403 — the failing source is dropped
 * rather than blocking the whole roster.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';
import type { GitLabApiClient, GitLabMember } from './api.js';

/** Narrow shape the identity module needs from the integration base. */
export interface GitLabIdentityHost {
  /** All contexts (direct or per-connection) the integration has ready. */
  activeContexts(): Promise<Array<{ api: GitLabApiClient; host: string }>>;
}

function matchesQuery(account: IntegrationCandidateAccount, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (account.label.toLowerCase().includes(needle)) return true;
  if (account.externalUserId.toLowerCase().includes(needle)) return true;
  return false;
}

function isActive(member: GitLabMember): boolean {
  return !member.state || member.state === 'active';
}

/** Iterate every project the client can see and dedupe their members by id. */
async function collectFromContext(api: GitLabApiClient, host: string, query: string | undefined) {
  const perProjectPageSize = 100; // matches GitLab's cap
  const accounts = new Map<string, IntegrationCandidateAccount>();
  let projectPage = 1;
  // Cap project walks at 20 pages (~2000 projects) so a huge org doesn't
  // stall the identity dropdown.
  for (; projectPage <= 20; projectPage++) {
    let projects;
    try {
      projects = await api.listProjects({ page: projectPage });
    } catch {
      break;
    }
    for (const project of projects) {
      let memberPage = 1;
      // Small cap per project — most orgs have <1000 members per project.
      for (; memberPage <= 10; memberPage++) {
        let members: GitLabMember[];
        try {
          members = await api.listProjectMembers(String(project.id), {
            page: memberPage,
            ...(query ? { query } : {}),
          });
        } catch {
          break;
        }
        for (const member of members) {
          if (!isActive(member)) continue;
          const key = `${member.id}`;
          if (accounts.has(key)) continue;
          accounts.set(key, {
            externalUserId: member.username,
            label: member.name || member.username,
            ...(member.avatar_url ? { avatarUrl: member.avatar_url } : {}),
            installation: host,
          });
        }
        if (members.length < perProjectPageSize) break;
      }
    }
    if (projects.length < perProjectPageSize) break;
  }
  return [...accounts.values()];
}

export function buildGitlabIdentity(host: GitLabIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId: _orgId, query }) {
      let contexts;
      try {
        contexts = await host.activeContexts();
      } catch {
        return [];
      }
      const collected = new Map<string, IntegrationCandidateAccount>();
      for (const ctx of contexts) {
        const members = await collectFromContext(ctx.api, ctx.host, query);
        for (const member of members) {
          // Dedupe cross-context by (installation, externalUserId).
          const key = `${member.installation ?? ''}:${member.externalUserId}`;
          if (!collected.has(key)) collected.set(key, member);
        }
      }
      return [...collected.values()].filter(account => matchesQuery(account, query));
    },
  } satisfies IntegrationIdentityCapability;
}
