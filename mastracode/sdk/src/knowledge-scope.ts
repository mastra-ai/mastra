import type { AgentScopeEntry } from '@mastra/core/agent';
import type { MastraCodeState } from './schema.js';

/**
 * The org tag local (TUI/studio) Knowledge is written under when the caller gives no tags. A
 * fixed literal on purpose: deriving it from a hostname, machine id or path would fragment local
 * Knowledge per machine or checkout, so several machines sharing one store could never share it.
 */
export const LOCAL_KNOWLEDGE_ORG_ID = 'local';

export type KnowledgeSessionScopes =
  | { resolved: true; scopes: AgentScopeEntry[] }
  | { resolved: false; reason: string };

function tagOf(entry: AgentScopeEntry): string {
  return typeof entry === 'string' ? entry : entry.scope;
}

const writable = (scope: string): AgentScopeEntry => ({ scope, access: 'write' });

function isIdentityTag(tag: string): boolean {
  return tag.startsWith('resource:') || tag.startsWith('thread:');
}

/**
 * The scope tags a session's runs act with: the host's `knowledge.scopes` plus the session's own.
 * Every Knowledge reader and writer in a session (the code agent, the /knowledge inspector) uses
 * this, so what the agent writes is what the inspector reads.
 *
 * The tags this adds are writable; the host's keep the access the host gave them.
 *
 * - Factory sessions require `org:<factoryOrgId>` and `project:<factoryProjectId>`, so projects stay
 *   isolated. A host tag of the same type with another value is refused. A Factory session with
 *   no org resolves to nothing (fail closed): a session owner is a user id, never an org.
 * - Local sessions get `org:local` only when the host gives no tags besides `resource:`/`thread:`.
 *   Any host tag (`org:self`, `team:self:x`) turns the default off.
 */
export function resolveKnowledgeSessionScopes(
  state: MastraCodeState | undefined,
  hostScopes: readonly AgentScopeEntry[] = [],
): KnowledgeSessionScopes {
  const projectId = typeof state?.factoryProjectId === 'string' ? state.factoryProjectId.trim() : '';
  const orgId = typeof state?.factoryOrgId === 'string' ? state.factoryOrgId.trim() : '';
  const factoryOwned = projectId.length > 0 || orgId.length > 0 || state?.factoryOrgUnresolved === true;

  if (factoryOwned) {
    if (!orgId) return { resolved: false, reason: 'This Factory session has no resolved organization.' };
    const required = [`org:${orgId}`, ...(projectId ? [`project:${projectId}`] : [])];
    for (const entry of hostScopes) {
      const tag = tagOf(entry);
      const type = tag.slice(0, tag.indexOf(':') + 1);
      const conflict = required.find(requiredTag => requiredTag.startsWith(type) && requiredTag !== tag);
      if (type && conflict && (type === 'org:' || type === 'project:')) {
        return { resolved: false, reason: `Scope ${tag} conflicts with this Factory session's ${conflict}.` };
      }
    }
    const held = new Set(hostScopes.map(tagOf));
    return { resolved: true, scopes: [...hostScopes, ...required.filter(tag => !held.has(tag)).map(writable)] };
  }

  if (hostScopes.some(entry => !isIdentityTag(tagOf(entry)))) return { resolved: true, scopes: [...hostScopes] };
  return { resolved: true, scopes: [...hostScopes, writable(`org:${LOCAL_KNOWLEDGE_ORG_ID}`)] };
}

/**
 * The scopes a run acts with when its session is unresolved: only the host's `resource:`/`thread:`
 * tags, so its writes stay private to the run and no host tag stands in for the missing org.
 */
export function knowledgeUnresolvedScopes(hostScopes: readonly AgentScopeEntry[]): AgentScopeEntry[] {
  return hostScopes.filter(entry => isIdentityTag(tagOf(entry)));
}

/** The non-identity tags of a session's scopes, as plain strings. */
export function knowledgeSessionTags(scopes: readonly AgentScopeEntry[]): string[] {
  return scopes.map(tagOf).filter(tag => !isIdentityTag(tag));
}
