/**
 * The tenant organization a session's knowledge is scoped to.
 *
 * Subconscious knowledge curation scopes every node and record on
 * `factoryOrgId`. A session that reaches the curation seam without one used to
 * fall back to the session owner id — for factory sessions the agent
 * controller's own id — so the knowledge landed under an org rung no reader
 * ever queries. The write succeeded and the read could never see it.
 *
 * The fix is that every session-creation path seeds the org it already holds,
 * and a path that cannot resolve one marks the session `factoryOrgUnresolved`
 * so the curation side refuses loudly instead of inventing an identity. "No
 * project id" is not a proxy for "not a factory session" — chat sessions and
 * Slack channel sessions are factory-owned and carry no project id — which is
 * why the unresolved case needs its own explicit marker.
 */

/**
 * Session-state fields org seeding writes. The index signatures mirror
 * `MastraCodeState` so a concrete `Session.state.set(Partial<MastraCodeState>)`
 * stays assignable to this minimal surface (contravariant parameter check).
 */
export interface OrgSeedStateWrites {
  [key: string]: unknown;
  [key: `subagentModelId_${string}`]: string | undefined;
  factoryOrgId?: string;
  factoryOrgUnresolved?: boolean;
}

/** The slice of a session needed to seed its organization. */
export interface OrgSeedableSession {
  state: {
    get: () => Record<string, unknown> | undefined;
    set: (updates: OrgSeedStateWrites) => Promise<void> | void;
  };
}

/**
 * A request context carrying the tenant on its `user` key. Slack stamps
 * `{ id, organizationId }` and the GitHub webhook `{ workosId, organizationId }`,
 * so only the shared `organizationId` field may be read here.
 */
export interface OrgBearingRequestContext {
  get: (key: string) => unknown;
}

/** Read the tenant org off a request context's `user` key, if there is one. */
export function readRequestContextOrgId(requestContext: OrgBearingRequestContext | undefined): string | undefined {
  if (!requestContext) return undefined;
  const user = requestContext.get('user');
  if (!user || typeof user !== 'object') return undefined;
  const orgId = (user as { organizationId?: unknown }).organizationId;
  return typeof orgId === 'string' ? orgId : undefined;
}

/**
 * Whether a session state value counts as a resolved organization.
 *
 * The curation side trims before deciding (`sdk/src/agents/memory.ts`), so the
 * recovery guards have to agree with it: a whitespace-only value that reads as
 * truthy here would look resolved to a heal path while curation still refuses,
 * and nothing would ever repair it. Not every seam routes its seed through
 * `seedSessionOrg`, so this cannot be assumed away.
 */
export function hasResolvedOrg(orgId: unknown): boolean {
  return typeof orgId === 'string' && orgId.trim().length > 0;
}

/**
 * Seed the session's organization, or mark it unresolved when there is none.
 *
 * An absent, empty, or whitespace-only org is a refusal, not a fallback: a
 * blank org rung is not something canonicalization can save. A successful
 * resolve also clears a stale marker, because the session-start hook runs at
 * most once per session per process and nothing else would ever clear it.
 *
 * Best-effort by contract — every caller is a session-created listener that
 * must not sink a run that is otherwise ready.
 */
export async function seedSessionOrg(session: OrgSeedableSession, orgId: string | null | undefined): Promise<void> {
  const resolved = typeof orgId === 'string' ? orgId.trim() : '';
  // Some session shapes (approval stubs, lightweight doubles) carry no state at
  // all. There is nothing to seed and nothing to mark, so this is not a warning.
  if (typeof session.state?.get !== 'function' || typeof session.state?.set !== 'function') return;
  try {
    const state = session.state.get() ?? {};
    if (!resolved) {
      if (state.factoryOrgUnresolved !== true) {
        await session.state.set({ factoryOrgUnresolved: true });
      }
      return;
    }
    const updates: OrgSeedStateWrites = {};
    if (state.factoryOrgId !== resolved) updates.factoryOrgId = resolved;
    if (state.factoryOrgUnresolved) updates.factoryOrgUnresolved = false;
    if (Object.keys(updates).length > 0) await session.state.set(updates);
  } catch (error) {
    console.warn('[Factory org seed] Unable to record the session organization.', error);
  }
}
