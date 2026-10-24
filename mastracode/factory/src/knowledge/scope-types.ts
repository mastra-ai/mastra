import type { KnowledgeScopeTypesConfig } from '@mastra/core/knowledge';

/**
 * Factory's Knowledge identity: org → project → thread. Every session of a project shares the
 * project scope, and a session's thread nests under the project it was created in. Hosts that pass
 * their own Knowledge to Factory spread this into its `scopes`.
 */
export const factoryKnowledgeScopeTypes: KnowledgeScopeTypesConfig = {
  'org:$orgId': { identity: true, access: [{ principal: 'self', role: 'owner' }] },
  'project:$projectId': { identity: true, parent: 'org:$orgId', access: [{ principal: 'self', role: 'owner' }] },
  'thread:$threadId': { identity: true, parent: 'project:$projectId', access: [{ principal: 'self', role: 'owner' }] },
};
