import type { MastraCodeState } from './schema.js';

/**
 * The organization rung local (TUI/studio) knowledge is curated under. A fixed
 * literal on purpose: deriving it from a hostname, machine id, or path would
 * fragment local knowledge per machine or checkout, and a user running several
 * machines against one shared store could never share knowledge between them.
 * Resolving a real org id (settings, /knowledge, login) is future work; when it
 * lands, it replaces this default here.
 */
export const LOCAL_KNOWLEDGE_ORG_ID = 'local';

export type KnowledgeScopeIdentity =
  | {
      resolved: true;
      organizationId: string;
      /** The Factory project a session belongs to; its Knowledge scope sits under the org. */
      projectId?: string;
    }
  | { resolved: false; projectId?: string; reason?: string };

/**
 * The single source of truth for which org and project a session's knowledge
 * lives under. Every reader and writer of the knowledge store (the code agent's
 * run scopes, the /knowledge inspector) must derive its scope from here so that
 * what curation writes is what the browser reads.
 *
 * - Factory seeds the authoritative org id into session state. There is no
 *   fallback: a session owner is a USER id, never an organization, so a
 *   Factory-owned session without an org resolves to nothing (fail closed).
 * - Factory runs share one knowledge graph per project, through the
 *   `project:<id>` scope.
 * - TUI/studio sessions use {@link LOCAL_KNOWLEDGE_ORG_ID}.
 */
export function resolveKnowledgeScopeIdentity(state: MastraCodeState | undefined): KnowledgeScopeIdentity {
  const factoryProjectId = state?.factoryProjectId;
  const projectId =
    typeof factoryProjectId === 'string' && factoryProjectId.trim().length > 0 ? factoryProjectId : undefined;
  const factoryOrgId = state?.factoryOrgId;
  const factoryOwned = projectId !== undefined || state?.factoryOrgUnresolved === true;

  // Trimmed to match what the Factory org seeder stores; not every seam routes
  // its seed through it.
  const organizationId = typeof factoryOrgId === 'string' ? factoryOrgId.trim() : '';
  if (organizationId) return { resolved: true, organizationId, ...(projectId ? { projectId } : {}) };
  if (factoryOwned) return { resolved: false, ...(projectId ? { projectId } : {}) };
  return { resolved: true, organizationId: LOCAL_KNOWLEDGE_ORG_ID };
}

/**
 * The agent scopes a session's runs hold for Knowledge: its org, and its Factory project when it
 * has one. Core marks an Agent's own `scopes` as trusted, so Subconscious reads them instead of
 * request-context strings. An unresolved identity holds none, so Subconscious fails closed.
 */
export function knowledgeAgentScopes(identity: KnowledgeScopeIdentity): string[] {
  if (!identity.resolved) return [];
  return [`org:${identity.organizationId}`, ...(identity.projectId ? [`project:${identity.projectId}`] : [])];
}
