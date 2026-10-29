import type { MastraCodeState } from './schema.js';

/**
 * The org tag the built-in (`knowledge: true`) Knowledge writes under when the host gives no scopes. A
 * fixed literal on purpose: deriving it from a hostname, machine id or path would fragment local
 * Knowledge per machine or checkout, so several machines sharing one store could never share it.
 */
export const LOCAL_KNOWLEDGE_ORG_ID = 'local';

export type KnowledgeSessionScopes = { resolved: true; scopes: string[] } | { resolved: false; reason: string };

function isIdentityTag(tag: string): boolean {
  return tag.startsWith('resource:') || tag.startsWith('thread:');
}

/**
 * The scope tags a session's runs act with: the host's `knowledge.scopes` plus the session's own.
 * Every Knowledge reader and writer in a session (the code agent, the /knowledge inspector) uses
 * this, so what the agent writes is what the inspector reads.
 *
 * - Factory sessions require `org:<factoryOrgId>` and `project:<factoryProjectId>`, so projects stay
 *   isolated. A host tag of the same type with another value is refused. A Factory session with
 *   no org resolves to nothing (fail closed): a session owner is a user id, never an org.
 * - Local sessions act with the host's scopes as given.
 */
export function resolveKnowledgeSessionScopes(
  state: MastraCodeState | undefined,
  hostScopes: readonly string[] = [],
): KnowledgeSessionScopes {
  const projectId = typeof state?.factoryProjectId === 'string' ? state.factoryProjectId.trim() : '';
  const orgId = typeof state?.factoryOrgId === 'string' ? state.factoryOrgId.trim() : '';
  const factoryOwned = projectId.length > 0 || orgId.length > 0 || state?.factoryOrgUnresolved === true;

  if (factoryOwned) {
    if (!orgId) return { resolved: false, reason: 'This Factory session has no resolved organization.' };
    const required = [`org:${orgId}`, ...(projectId ? [`project:${projectId}`] : [])];
    for (const tag of hostScopes) {
      const type = tag.slice(0, tag.indexOf(':') + 1);
      const conflict = required.find(requiredTag => requiredTag.startsWith(type) && requiredTag !== tag);
      if (type && conflict && (type === 'org:' || type === 'project:')) {
        return { resolved: false, reason: `Scope ${tag} conflicts with this Factory session's ${conflict}.` };
      }
    }
    const held = new Set(hostScopes);
    return { resolved: true, scopes: [...hostScopes, ...required.filter(tag => !held.has(tag))] };
  }

  return { resolved: true, scopes: [...hostScopes] };
}

/**
 * The scopes a run acts with when its session is unresolved: only the host's `resource:`/`thread:`
 * tags, so its writes stay private to the run and no host tag stands in for the missing org.
 */
export function knowledgeUnresolvedScopes(hostScopes: readonly string[]): string[] {
  return hostScopes.filter(isIdentityTag);
}

/** The non-identity tags of a session's scopes, as plain strings. */
export function knowledgeSessionTags(scopes: readonly string[]): string[] {
  return scopes.filter(tag => !isIdentityTag(tag));
}
