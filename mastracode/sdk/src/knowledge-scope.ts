import { createHash } from 'node:crypto';
import { hostname } from 'node:os';

import type { MastraCodeState } from './schema.js';

/**
 * The organization rung local (TUI/studio) knowledge is curated under.
 *
 * Outside Factory nothing can tell us a real organization yet, so the org rung
 * defaults to the machine: org = this machine, resource = the project, thread =
 * the session. Deliberately hostname-only — the session owner id also hashes
 * the project path, which would make "org" mean "this checkout" and org-level
 * knowledge would never span projects. Resolving a real org id (config, shared
 * store, login) is future work; when it lands, it replaces this default here.
 */
export function localKnowledgeOrgId(machineName: string = hostname()): string {
  return `mastracode-${createHash('sha256').update(machineName).digest('hex').slice(0, 12)}`;
}

export type KnowledgeScopeIdentity =
  | {
      resolved: true;
      organizationId: string;
      /** Set when the resource rung is anchored on something other than the session resource. */
      knowledgeResourceId?: string;
    }
  | { resolved: false; knowledgeResourceId?: string };

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
 * - TUI/studio sessions default the org rung to this machine (see
 *   {@link localKnowledgeOrgId}).
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
  return { resolved: true, organizationId: localKnowledgeOrgId() };
}
