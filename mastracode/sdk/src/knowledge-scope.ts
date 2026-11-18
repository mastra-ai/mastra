import { encodeKnowledgeScopeId } from './knowledge-scope-id.js';
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
 * The scope tags a session's runs act with, beside each run's own identity tags: the host's `scopes`
 * plus the session's own.
 * Every Knowledge reader and writer in a session (the code agent, the /knowledge inspector) uses
 * this, so what the agent writes is what the inspector reads.
 *
 * - Factory sessions require `org:<factoryOrgId>` and `project:<factoryProjectId>`, with each id
 *   encoded into one canonical segment, so projects stay isolated. A host `project:` tag with another
 *   value is refused. A Factory session with no org resolves to nothing (fail closed): a
 *   session owner is a user id, never an org.
 * - A Factory session refuses a host `resource:` or `thread:` tag: those are each run's own identity,
 *   and a host one would let every run read that user's or thread's pages.
 * - When the host's scopes name an `org:`, a Factory session acts with the host's scopes alone, without
 *   its own `org:` and `project:` tags, for a Knowledge instance that declares only that org; every org
 *   and project on the host shares it. A host `project:` tag is refused then, so the host can't stand
 *   in for a project.
 * - Local sessions act with the host's scopes as given; they are canonical addresses already.
 */
export function resolveKnowledgeSessionScopes(
  state: Pick<MastraCodeState, 'factoryOrgId' | 'factoryProjectId' | 'factoryOrgUnresolved'> | undefined,
  hostScopes: readonly string[] = [],
): KnowledgeSessionScopes {
  const projectId = typeof state?.factoryProjectId === 'string' ? state.factoryProjectId.trim() : '';
  const orgId = typeof state?.factoryOrgId === 'string' ? state.factoryOrgId.trim() : '';
  const factoryOwned = projectId.length > 0 || orgId.length > 0 || state?.factoryOrgUnresolved === true;

  if (factoryOwned) {
    if (!orgId) return { resolved: false, reason: 'This Factory session has no resolved organization.' };
    // A run's identity tags are its own; a host tag would make another user's pages readable.
    const identity = hostScopes.find(isIdentityTag);
    if (identity)
      return { resolved: false, reason: `Scope ${identity} is a run's identity and can't be a host scope.` };
    const hostOrg = hostScopes.find(tag => tag.startsWith('org:'));
    if (hostOrg) {
      const refused = hostScopes.find(tag => tag.startsWith('project:'));
      if (refused) return { resolved: false, reason: `Scope ${refused} can't be held with the host's ${hostOrg}.` };
      return { resolved: true, scopes: [...hostScopes] };
    }
    const required = [
      `org:${encodeKnowledgeScopeId(orgId)}`,
      ...(projectId ? [`project:${encodeKnowledgeScopeId(projectId)}`] : []),
    ];
    for (const tag of hostScopes) {
      const conflict = required.find(requiredTag => requiredTag.startsWith('project:') && requiredTag !== tag);
      if (tag.startsWith('project:') && conflict) {
        return { resolved: false, reason: `Scope ${tag} conflicts with this Factory session's ${conflict}.` };
      }
    }
    const held = new Set(hostScopes);
    return { resolved: true, scopes: [...hostScopes, ...required.filter(tag => !held.has(tag))] };
  }

  return { resolved: true, scopes: [...hostScopes] };
}

/**
 * The host's `resource:`/`thread:` tags.
 * @deprecated Unused: an unresolved Factory session now adds no host tags to a run's scopes.
 */
export function knowledgeUnresolvedScopes(hostScopes: readonly string[]): string[] {
  return hostScopes.filter(isIdentityTag);
}

/** The non-identity tags of a session's scopes, as plain strings. */
export function knowledgeSessionTags(scopes: readonly string[]): string[] {
  return scopes.filter(tag => !isIdentityTag(tag));
}
