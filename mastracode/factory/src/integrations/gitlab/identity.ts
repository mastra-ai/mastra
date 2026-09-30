/**
 * GitLab identity capability.
 *
 * The user's requested semantics: "list all group/org members". GitLab
 * memberships are hierarchical — a project inherits members from its
 * ancestor group, which inherits from its parent group, and so on. Rather
 * than force operators to configure a specific group id here, we walk the
 * projects the integration already knows about (`activeContexts()` +
 * `listProjects`), derive the distinct top-level namespaces, and call
 * `GET /groups/:id/members/all` once per group — which returns every user
 * who inherits access anywhere under that group. Personal namespaces have
 * no group, so those fall back to one representative project's
 * `members/all`. Deduplication by GitLab numeric user id then produces a
 * clean union across every configured connection.
 *
 * Discovery is scoped to the requesting `orgId`. In Platform mode the
 * client is deployment-level, so a shared deployment could otherwise
 * expose members from connections belonging to a different tenant. We
 * intersect the active-context connection ids with the connection ids the
 * org has registered through Factory's source-control storage and only
 * walk that intersection. Fresh Platform installs surface no members
 * until the org has registered at least one GitLab installation — a UX
 * trade-off to prevent cross-tenant leaks. Direct mode is inherently
 * single-tenant and returns every active connection id from
 * `listOrgConnectionIds()` so behavior there is unchanged.
 *
 * A hard request budget caps the total member calls per context so a huge
 * org (hundreds of projects) can't turn one identity-dropdown request into
 * thousands of sequential API calls. Failures degrade gracefully — a
 * missing connection or a 403 on one roster source drops that source
 * rather than blocking the whole roster.
 */

import type { IntegrationCandidateAccount, IntegrationIdentityCapability } from '../base.js';
import type { GitLabApiClient, GitLabMember, GitLabProject } from './api.js';

/** Narrow shape the identity module needs from the integration base. */
export interface GitLabIdentityHost {
  /** All contexts (direct or per-connection) the integration has ready. */
  activeContexts(): Promise<Array<{ connectionId: string; api: GitLabApiClient; host: string }>>;
  /**
   * Connection ids the requesting org has registered in Factory storage
   * (direct mode returns the single direct-connection id; Platform mode
   * intersects deployment-wide connections against the org's source-control
   * installations). Used to filter `activeContexts()` so a shared Platform
   * deployment never leaks another tenant's members.
   */
  listOrgConnectionIds(orgId: string): Promise<Set<string>>;
}

const MEMBER_PAGE_SIZE = 100; // matches GitLab's cap
const MAX_PROJECT_PAGES = 5;
const MAX_MEMBER_PAGES_PER_SOURCE = 10;
/** Hard cap on member requests per context, across all roster sources. */
const MAX_MEMBER_REQUESTS = 30;

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

/**
 * Derive the distinct top-level namespaces from the projects the client can
 * see, keeping every discovered project per namespace: group rosters miss
 * users added directly to a single project, so each project's own roster is
 * also walked (within the request budget).
 */
async function discoverNamespaces(api: GitLabApiClient, signal?: AbortSignal): Promise<Map<string, GitLabProject[]>> {
  const namespaces = new Map<string, GitLabProject[]>();
  for (let projectPage = 1; projectPage <= MAX_PROJECT_PAGES; projectPage++) {
    if (signal?.aborted) break;
    let projects: GitLabProject[];
    try {
      projects = await api.listProjects({ page: projectPage });
    } catch {
      break;
    }
    for (const project of projects) {
      const topLevel = project.path_with_namespace.split('/')[0];
      if (!topLevel) continue;
      const existing = namespaces.get(topLevel);
      if (existing) existing.push(project);
      else namespaces.set(topLevel, [project]);
    }
    if (projects.length < MEMBER_PAGE_SIZE) break;
  }
  return namespaces;
}

/**
 * Resolve the member roster per top-level namespace. The group `members/all`
 * walk covers everyone who inherits access under a group (sub-groups
 * included) in one paged source, but not users granted access on a single
 * project only — so each discovered project's `members/all` is walked too,
 * spending the remaining request budget. Personal namespaces have no group,
 * so their project walks are the only source.
 */
async function collectFromContext(api: GitLabApiClient, host: string, query: string | undefined, signal?: AbortSignal) {
  const accounts = new Map<string, IntegrationCandidateAccount>();
  const addMembers = (members: GitLabMember[]) => {
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
  };

  const namespaces = await discoverNamespaces(api, signal);
  let requestBudget = MAX_MEMBER_REQUESTS;
  // Failures degrade per source: a 403/404 on one roster walk drops that
  // source and moves on.
  const walkSource = async (fetchPage: (page: number) => Promise<GitLabMember[]>) => {
    for (let page = 1; page <= MAX_MEMBER_PAGES_PER_SOURCE && requestBudget > 0; page++) {
      if (signal?.aborted) return;
      requestBudget--;
      let members: GitLabMember[];
      try {
        members = await fetchPage(page);
      } catch {
        return;
      }
      addMembers(members);
      if (members.length < MEMBER_PAGE_SIZE) break;
    }
  };

  for (const [topLevel, projects] of namespaces) {
    if (requestBudget <= 0 || signal?.aborted) break;
    // Group roster first — one paged walk covers everyone who inherits
    // access anywhere under the group, including sub-groups.
    await walkSource(page => api.listGroupMembers(topLevel, { page, ...(query ? { query } : {}) }));
    // Then each discovered project's roster: users added directly to a
    // project don't appear in the group roster, and personal namespaces
    // have no group at all. The shared budget keeps huge orgs bounded.
    for (const project of projects) {
      if (requestBudget <= 0 || signal?.aborted) break;
      await walkSource(page => api.listProjectMembers(String(project.id), { page, ...(query ? { query } : {}) }));
    }
  }
  return [...accounts.values()];
}

export function buildGitlabIdentity(host: GitLabIdentityHost): IntegrationIdentityCapability {
  return {
    async listCandidateAccounts(_ctx, { orgId, query, signal }) {
      // Read the org's registered connection ids first: if it hasn't
      // registered any (fresh Platform install), there's nothing to list
      // — skipping the API entirely keeps a shared deployment from
      // surfacing another tenant's members.
      let orgConnectionIds: Set<string>;
      try {
        orgConnectionIds = await host.listOrgConnectionIds(orgId);
      } catch {
        return [];
      }
      if (orgConnectionIds.size === 0) return [];
      let contexts;
      try {
        contexts = await host.activeContexts();
      } catch {
        return [];
      }
      // Intersect deployment-scoped active contexts with the org's own
      // registered connections. Anything the org has not registered is
      // dropped — its members are not this org's business.
      const scoped = contexts.filter(ctx => orgConnectionIds.has(ctx.connectionId));
      if (scoped.length === 0) return [];
      const collected = new Map<string, IntegrationCandidateAccount>();
      for (const ctx of scoped) {
        if (signal?.aborted) break;
        const members = await collectFromContext(ctx.api, ctx.host, query, signal);
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
