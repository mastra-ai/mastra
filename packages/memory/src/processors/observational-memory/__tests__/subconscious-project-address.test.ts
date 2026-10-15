import { setRunAgentScopes } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

function setup() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({ id: 'project-address', storage });
  return { memory: new Memory({ storage, knowledge }) };
}

function orgContext(projectId?: string) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  if (projectId) setRunAgentScopes(requestContext, [`project:${projectId}`]);
  return requestContext;
}

describe('Subconscious project Knowledge address', () => {
  it('keeps a project graph apart from a user resource with the same id', async () => {
    const { memory } = setup();
    const project = await resolveKnowledgeScopeIds(memory, {
      agent: { resourceId: 'session-user', threadId: 't1' },
      requestContext: orgContext('shared-id'),
    });
    const user = await resolveKnowledgeScopeIds(memory, {
      agent: { resourceId: 'shared-id', threadId: 't2' },
      requestContext: orgContext(),
    });
    expect(project[0]).toEqual(user[0]);
    expect(project[1]).not.toEqual(user[1]);
  });

  it('addresses the project rung as project:<id> and leaves the user resource:<sameId> untouched', async () => {
    const { memory } = setup();
    const user = await resolveKnowledgeScopeIds(memory, {
      agent: { resourceId: 'shared-id', threadId: 't2' },
      requestContext: orgContext(),
    });
    const project = await resolveKnowledgeScopeIds(memory, {
      agent: { resourceId: 'session-user', threadId: 't1' },
      requestContext: orgContext('shared-id'),
    });
    const store = await memory.getKnowledgeStore();
    expect((await store.getScopeAddress('project:shared-id'))?.scopeNodeId).toBe(project[1]);
    expect((await store.getScopeAddress('project:shared-id:thread:t1'))?.scopeNodeId).toBe(project[2]);
    // The user's own resource scope still resolves to the node it had before the project existed.
    expect((await store.getScopeAddress('resource:shared-id'))?.scopeNodeId).toBe(user[1]);
    expect((await store.getScopeAddress('resource:shared-id:thread:t2'))?.scopeNodeId).toBe(user[2]);
  });
});
