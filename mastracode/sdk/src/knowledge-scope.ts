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
      /** Set when the resource rung is anchored on something other than the session resource. */
      knowledgeResourceId?: string;
    }
  | { resolved: false; knowledgeResourceId?: string; reason?: string };

/**
 * The single source of truth for which org/resource rungs a session's knowledge
 * lives under. Every reader and writer of the knowledge store (the subconscious
 * memory factory, the /knowledge inspector) must derive its scope from here so
 * that what curation writes is what the browser reads.
 *
 * - Factory seeds the authoritative org id into session state. There is no
 *   fallback: a session owner is a USER id, never an organization, so a
 *   Factory-owned session without an org resolves to nothing (fail closed).
 * - Factory runs share one knowledge graph per project, so the resource rung is
 *   anchored on the project id.
 * - TUI/studio sessions use {@link LOCAL_KNOWLEDGE_ORG_ID}.
 */
export function resolveKnowledgeScopeIdentity(state: MastraCodeState | undefined): KnowledgeScopeIdentity {
  const factoryProjectId = state?.factoryProjectId;
  const isFactory = typeof factoryProjectId === 'string' && factoryProjectId.trim().length > 0;
  const factoryOrgId = state?.factoryOrgId;
  const factoryOwned = isFactory || state?.factoryOrgUnresolved === true;

  // Trimmed to match what the Factory org seeder stores; not every seam routes
  // its seed through it.
  const organizationId = typeof factoryOrgId === 'string' ? factoryOrgId.trim() : '';
  if (organizationId) {
    return {
      resolved: true,
      organizationId,
      knowledgeResourceId: isFactory ? factoryProjectId : undefined,
    };
  }
  if (factoryOwned) {
    return { resolved: false, knowledgeResourceId: isFactory ? factoryProjectId : undefined };
  }
  return { resolved: true, organizationId: LOCAL_KNOWLEDGE_ORG_ID };
}
