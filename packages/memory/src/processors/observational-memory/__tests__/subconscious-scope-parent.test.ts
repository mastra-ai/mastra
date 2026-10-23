import { setRunAgentScopes } from '@mastra/core/agent';
import { Knowledge, memoryScopeTypes } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { expect, it } from 'vitest';

import { Memory } from '../../../index';
import {
  createKnowledgeReadTools,
  getKnowledgeStore,
  resolveRunKnowledgeScopes,
} from '../subconscious/knowledge-tools';

it.each([false, true])('refuses cross-org resource reuse before reading (Knowledge facade: %s)', async facade => {
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    ...(facade ? { knowledge: new Knowledge({ id: 'scopes', storage, scopes: memoryScopeTypes }) } : {}),
  });
  const context = (org: string, threadId: string) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, [`org:${org}`]);
    return { requestContext, agent: { resourceId: 'shared', threadId } };
  };
  const a = await resolveRunKnowledgeScopes(memory, context('a', 'thread-a'));
  const store = await getKnowledgeStore(memory);
  const node = await store.createNode({ name: 'Private node', scopeIds: [a.levels[1]!.scopeId] });
  await store.createRecord({ node, text: 'Private text', source: 'test', scopeIds: [a.levels[1]!.scopeId] });
  const tools = createKnowledgeReadTools(memory);
  const read = () => tools.knowledge_read.execute!({ id: node.id }, context('b', 'thread-b'));
  await expect(read()).rejects.toThrow('parent other than org:b');
  expect(await store.getScopeAddress('thread:thread-b')).toBeNull();
  const own = await tools.knowledge_read.execute!({ id: node.id }, context('a', 'thread-a2'));
  expect(JSON.stringify(own)).toContain('Private text');
});

it('refuses bare-storage thread reuse under another resource', async () => {
  const memory = new Memory({ storage: new InMemoryStore() });
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:a']);
  await resolveRunKnowledgeScopes(memory, { requestContext, agent: { resourceId: 'first', threadId: 'shared' } });
  await expect(
    resolveRunKnowledgeScopes(memory, { requestContext, agent: { resourceId: 'second', threadId: 'shared' } }),
  ).rejects.toThrow('parent other than resource:second');
});
