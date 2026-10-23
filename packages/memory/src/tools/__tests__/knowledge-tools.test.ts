import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent, setRunAgentScopes } from '@mastra/core/agent';
import { Knowledge, memoryScopeTypes } from '@mastra/core/knowledge';
import type { KnowledgeToolsConfig } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore, knowledgeImporterBindingKey } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it } from 'vitest';

import { createKnowledgeTools, Memory, Subconscious } from '../..';

const READ_TOOLS = ['knowledge_browse', 'knowledge_read', 'knowledge_search'];
const WRITE_TOOLS = [
  'knowledge_append',
  'knowledge_create',
  'knowledge_merge_nodes',
  'knowledge_remove',
  'knowledge_rename_node',
  'knowledge_rescope',
  'knowledge_set_node_kind',
  'knowledge_update_node',
  'knowledge_write_node_content',
  'knowledge_write_node_description',
];

function knowledgeOf(tools?: KnowledgeToolsConfig, storage = new InMemoryStore()) {
  return new Knowledge({ id: 'company', storage, scopes: memoryScopeTypes, tools });
}

function memoryWith(knowledge: Knowledge | string, subconscious?: Subconscious) {
  return new Memory({
    storage: new InMemoryStore(),
    knowledge,
    ...(subconscious
      ? {
          vector: {} as MastraVector,
          embedder: {} as MastraEmbeddingModel<string>,
          options: { observationalMemory: { model: 'openai/om-model', experimental_subconscious: subconscious } },
        }
      : {}),
  });
}

function context(threadId: string | null = 'alpha', resourceId = 'user-42', extra: object = {}) {
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  return {
    agent: { agentId: 'support', threadId: threadId ?? undefined, resourceId },
    requestContext,
    ...extra,
  } as any;
}

function knowledgeTools(knowledge: Knowledge) {
  return memoryWith(knowledge).listTools();
}

async function scopeIdOf(knowledge: Knowledge, address: string) {
  const scope = await (await knowledge.getStorage()).getScopeAddress(address);
  return scope!.scopeNodeId;
}

/** A model that calls one tool, then answers once it sees the result. */
function scriptedModel(toolName: string, input: Record<string, unknown>) {
  let calls = 0;
  const finish = (finishReason: 'stop' | 'tool-calls') => ({
    type: 'finish' as const,
    finishReason,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  });
  return new MockLanguageModelV2({
    doGenerate: async () => {
      calls += 1;
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      return calls === 1
        ? {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage,
            warnings: [],
            content: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName, input: JSON.stringify(input) }],
          }
        : {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage,
            warnings: [],
            content: [{ type: 'text' as const, text: 'Recorded.' }],
          };
    },
    doStream: async () => {
      calls += 1;
      const chunks =
        calls === 1
          ? [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'tool-call' as const, toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
              finish('tool-calls'),
            ]
          : [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'text-start' as const, id: 't' },
              { type: 'text-delta' as const, id: 't', delta: 'Recorded.' },
              { type: 'text-end' as const, id: 't' },
              finish('stop'),
            ];
      return { stream: convertArrayToReadableStream(chunks as any), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  } as any);
}

describe('Knowledge tools flag on the Knowledge instance', () => {
  it('gives no tools by default, the read tools for read, and the write set for write', () => {
    expect(Object.keys(knowledgeTools(knowledgeOf()))).toEqual([]);
    expect(Object.keys(knowledgeTools(knowledgeOf({ read: true }))).sort()).toEqual(READ_TOOLS);
    expect(Object.keys(knowledgeTools(knowledgeOf({ write: true }))).sort()).toEqual(WRITE_TOOLS);
    expect(Object.keys(knowledgeTools(knowledgeOf({ read: true, write: true }))).sort()).toEqual(
      [...READ_TOOLS, ...WRITE_TOOLS].sort(),
    );
  });

  it('lets a real agent write through the flag and keeps the record inside its thread', async () => {
    const knowledge = knowledgeOf({ read: true, write: true });
    const memory = new Memory({ storage: new InMemoryStore(), knowledge: 'company' });
    const support = new Agent({
      id: 'support',
      name: 'Support',
      instructions: 'Record decisions.',
      model: scriptedModel('knowledge_create', {
        name: 'Storage version',
        kind: 'decision',
        text: 'Knowledge storage is at version 3 since 2026-10-23.',
      }),
      memory,
      scopes: ['org:acme'],
    });
    new Mastra({ agents: { support }, knowledge: { company: knowledge }, logger: false });

    const result = await support.generate('We moved Knowledge storage to version 3.', {
      memory: { thread: 'alpha', resource: 'user-42' },
    });
    const call = result.toolResults.find(item => item.payload.toolName === 'knowledge_create');
    expect(call?.payload.result).toMatchObject({ node: { name: 'Storage version' } });

    const store = await knowledge.getStorage();
    const record = (call!.payload.result as any).record;
    expect(record.source).toBe('agent:support');
    expect(record.metadata.sourceThreadId).toBe('alpha');
    expect(await store.getRecordScopeIds(record.id)).toEqual([await scopeIdOf(knowledge, 'thread:alpha')]);

    const tools = memory.listTools();
    const sibling = await tools.knowledge_search!.execute!({ query: 'storage version' }, context('beta'));
    expect((sibling as any).results).toEqual([]);
    expect(await tools.knowledge_read!.execute!({ id: record.nodeId }, context('beta'))).toEqual({ found: false });
    const own = await tools.knowledge_read!.execute!({ id: record.nodeId }, context('alpha'));
    expect(own).toMatchObject({ found: true, records: [{ id: record.id }] });
  });

  it('shares resource-level writes across that resource’s threads and hides them from a sibling resource', async () => {
    const knowledge = knowledgeOf({ read: true, write: true });
    const tools = knowledgeTools(knowledge);
    const created = (await tools.knowledge_create!.execute!(
      { name: 'Billing owner', kind: 'person', text: 'Maya owns billing.', scope: 'resource' },
      context('alpha'),
    )) as any;
    expect(await (await knowledge.getStorage()).getRecordScopeIds(created.record.id)).toEqual([
      await scopeIdOf(knowledge, 'resource:user-42'),
    ]);

    const fromBeta = await tools.knowledge_read!.execute!({ id: created.node.id }, context('beta'));
    expect(fromBeta).toMatchObject({ found: true, records: [{ text: 'Maya owns billing.' }] });
    const otherResource = context('gamma', 'user-7');
    expect(await tools.knowledge_read!.execute!({ id: created.node.id }, otherResource)).toEqual({ found: false });
    expect((await tools.knowledge_search!.execute!({ query: 'billing' }, otherResource)) as any).toMatchObject({
      results: [],
    });
  });
});

describe('Knowledge tools with Subconscious', () => {
  it('lists each read tool once and only gives write tools through the flag', () => {
    const both = memoryWith(knowledgeOf({ read: true }), new Subconscious()).listTools();
    expect(
      Object.keys(both)
        .filter(id => id.startsWith('knowledge_'))
        .sort(),
    ).toEqual(READ_TOOLS);
    expect(both).toHaveProperty('ask_memory');

    const subconsciousOnly = memoryWith(knowledgeOf(), new Subconscious()).listTools();
    expect(
      Object.keys(subconsciousOnly)
        .filter(id => id.startsWith('knowledge_'))
        .sort(),
    ).toEqual(READ_TOOLS);

    const withWrites = memoryWith(knowledgeOf({ write: true }), new Subconscious()).listTools();
    expect(
      Object.keys(withWrites)
        .filter(id => id.startsWith('knowledge_'))
        .sort(),
    ).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
  });

  it('keeps the flag off the Subconscious agents’ own Memory, which carries its fixed tools', () => {
    const memory = memoryWith(knowledgeOf({ read: true, write: true }), new Subconscious());
    expect(Object.keys(memory.listTools()).filter(id => id.startsWith('knowledge_'))).toHaveLength(13);
    expect(memory.createSubconsciousMemory().listTools()).toEqual({});
  });
});

describe('createKnowledgeTools', () => {
  it('is exported from @mastra/memory and returns read tools unless write is set', () => {
    const knowledge = knowledgeOf();
    expect(Object.keys(createKnowledgeTools({ knowledge })).sort()).toEqual(READ_TOOLS);
    expect(Object.keys(createKnowledgeTools({ knowledge, write: true })).sort()).toEqual(
      [...READ_TOOLS, ...WRITE_TOOLS].sort(),
    );
  });

  it('works on a Knowledge instance with no Memory, using lexical search', async () => {
    const knowledge = knowledgeOf();
    const tools = createKnowledgeTools({ knowledge, write: true });
    await tools.knowledge_create!.execute!({ name: 'Wave 2', kind: 'project', text: 'Fania owns Wave 2.' }, context());
    const found = (await tools.knowledge_search!.execute!({ query: 'Fania' }, context())) as any;
    expect(found.results.length).toBeGreaterThan(0);
    expect(found.results.every((result: any) => result.sources.every((source: string) => source === 'lexical'))).toBe(
      true,
    );
  });

  it('resolves a Knowledge key through Mastra when a tool runs', async () => {
    const knowledge = knowledgeOf();
    const mastra = new Mastra({ knowledge: { company: knowledge }, logger: false });
    const tools = createKnowledgeTools({ knowledge: 'company', write: true });
    const created = (await tools.knowledge_create!.execute!(
      { name: 'Keyed', kind: 'note', text: 'Resolved by key.' },
      context('alpha', 'user-42', { mastra }),
    )) as any;
    expect(await (await knowledge.getStorage()).getRecord({ id: created.record.id })).toMatchObject({
      text: 'Resolved by key.',
    });

    await expect(tools.knowledge_search!.execute!({ query: 'x' }, context())).rejects.toThrow(
      /registered with Mastra to resolve the Knowledge key/,
    );
    const unknown = createKnowledgeTools({ knowledge: 'missing' });
    await expect(
      unknown.knowledge_search!.execute!({ query: 'x' }, context('alpha', 'user-42', { mastra })),
    ).rejects.toThrow(/Knowledge with key missing not found/);
  });
});

describe('Knowledge write tool rules', () => {
  it('soft-deletes records, stamps the agent, and has no tool that deletes a node', async () => {
    const knowledge = knowledgeOf();
    const tools = createKnowledgeTools({ knowledge, write: true });
    expect(Object.keys(tools).some(id => /delete|erase/.test(id))).toBe(false);
    const created = (await tools.knowledge_create!.execute!(
      { name: 'Draft', kind: 'note', text: 'Wrong fact.' },
      context(),
    )) as any;
    await tools.knowledge_remove!.execute!({ recordId: created.record.id }, context());

    const store = await knowledge.getStorage();
    expect(await store.getRecord({ id: created.record.id })).toBeNull();
    expect(await store.getRecord({ id: created.record.id, includeDeleted: true })).toMatchObject({
      deletedBy: 'agent:support',
    });
    expect(await store.getNode(created.node.id)).toMatchObject({ name: 'Draft' });
  });

  it('refuses to remove, rescope or merge away imported knowledge but allows appending to it', async () => {
    const knowledge = knowledgeOf();
    const tools = createKnowledgeTools({ knowledge, write: true });
    const store = await knowledge.getStorage();
    // Materialize the run's scopes, then write as an importer binding would.
    await tools.knowledge_search!.execute!({ query: 'seed' }, context());
    const threadScope = await scopeIdOf(knowledge, 'thread:alpha');
    const claimant = {
      importerId: 'linear',
      binding: knowledgeImporterBindingKey({ source: 'linear:acme', scope: 'thread:alpha' }),
      source: 'importer:linear',
    };
    const imported = await store.createNode({ name: 'MEM-1', kind: 'issue', scopeIds: [threadScope], claimant });
    const record = await store.createRecord({
      node: imported,
      text: 'MEM-1 is in progress.',
      scopeIds: [threadScope],
      source: 'importer:linear',
      claimant,
    });
    const local = (await tools.knowledge_create!.execute!(
      { name: 'Scratch', kind: 'note', text: 'Local note.' },
      context(),
    )) as any;

    await expect(tools.knowledge_remove!.execute!({ recordId: record.id }, context())).rejects.toThrow(
      /imported by linear/,
    );
    await expect(
      tools.knowledge_rescope!.execute!(
        { recordId: record.id, expectedVersion: record.version, scope: 'resource' },
        context(),
      ),
    ).rejects.toThrow(/imported by linear/);
    const node = (await store.getNode(imported.id))!;
    await expect(
      tools.knowledge_merge_nodes!.execute!(
        { sourceId: node.id, targetId: local.node.id, sourceVersion: node.version },
        context(),
      ),
    ).rejects.toThrow(/imported by linear/);
    expect(await store.getRecord({ id: record.id })).toMatchObject({ text: 'MEM-1 is in progress.' });

    const appended = (await tools.knowledge_append!.execute!(
      { node: imported.id, text: 'Agent note: blocked on review.' },
      context(),
    )) as any;
    expect(appended).toMatchObject({ nodeId: imported.id, source: 'agent:support' });

    // A local node can still be merged into the imported one.
    const merged = await tools.knowledge_merge_nodes!.execute!(
      { sourceId: local.node.id, targetId: imported.id, sourceVersion: local.node.version },
      context(),
    );
    expect(merged).toBeTruthy();
  });

  it('refuses writes without a thread and scope levels the run does not hold', async () => {
    const tools = createKnowledgeTools({ knowledge: knowledgeOf(), write: true });
    await expect(
      tools.knowledge_create!.execute!({ name: 'N', kind: 'note', text: 'T' }, context(null)),
    ).rejects.toThrow(/need a Memory thread/);
    await expect(
      tools.knowledge_create!.execute!({ name: 'N', kind: 'note', text: 'T', scope: 'project' }, context()),
    ).rejects.toThrow(/Unknown Knowledge scope level: project/);
    const smuggled = await tools.knowledge_create!.execute!(
      { name: 'N', kind: 'note', text: 'T', source: 'importer:linear' } as any,
      context(),
    );
    expect(smuggled).toMatchObject({ error: true });
  });
});
