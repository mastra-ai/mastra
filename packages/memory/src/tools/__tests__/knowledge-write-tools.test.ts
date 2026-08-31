import { Knowledge } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { describe, expect, it } from 'vitest';

import { Memory } from '../..';
import {
  createKnowledgeWriteTools,
  MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH,
} from '../../processors/observational-memory/subconscious/knowledge-write-tools';

const scopeIds = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
];

async function fixture() {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
  const store = (await memory.storage.getStore('knowledge'))!;
  await store.createNode({ id: scopeIds[0], name: 'Acme', isScope: true, scopeIds: [] });
  await store.createNode({ id: scopeIds[1], name: 'User 42', isScope: true, scopeIds: [scopeIds[0]!] });
  await store.createNode({ id: scopeIds[2], name: 'Thread alpha', isScope: true, scopeIds: [scopeIds[1]!] });
  const source = await store.createNode({ name: 'Atlas Initiative', kind: 'project', scopeIds: [scopeIds[2]!] });
  const target = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [scopeIds[2]!] });
  const tools = createKnowledgeWriteTools(memory, {
    scopeIds,
    sourceThreadId: 'alpha',
  });
  return { store, source, target, tools };
}

describe('Subconscious knowledge write tools', () => {
  it('keeps snapshots of all seven public input schemas', async () => {
    const { tools } = await fixture();
    expect(Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, tool.inputSchema]))).toMatchSnapshot();
  });

  it('keeps tool schemas free of top-level composition keywords Gemini rejects', async () => {
    // Google's API rejects `required` inside non-OBJECT anyOf branches, and the
    // schema-compat Google layer preserves root-level unions as-is — so these
    // tool schemas must not use top-level composition keywords (regression: the old
    // knowledge_update_node `anyOf: [{ required: ['name'] }, { required: ['kind'] }]`
    // made every Gemini curation fail with a 400 before the model ran).
    const { tools } = await fixture();
    expect(Object.keys(tools).length).toBeGreaterThan(0);
    for (const [name, tool] of Object.entries(tools)) {
      const schema = standardSchemaToJSONSchema(tool.inputSchema as never, { io: 'input' }) as Record<string, unknown>;
      // Guard against the wrapper hiding the schema and this test passing vacuously.
      expect(schema.type).toBe('object');
      expect({ name, anyOf: schema.anyOf, oneOf: schema.oneOf, allOf: schema.allOf }).toEqual({
        name,
        anyOf: undefined,
        oneOf: undefined,
        allOf: undefined,
      });
    }
  });

  it('requires at least one of name/kind in knowledge_update_node execute', async () => {
    const { target, tools } = await fixture();
    await expect(
      tools.knowledge_update_node!.execute?.({ node: target.id, expectedVersion: target.version }, {} as any),
    ).rejects.toThrow('at least one');
    const kindOnly = (await tools.knowledge_update_node!.execute?.(
      { node: target.id, expectedVersion: target.version, kind: 'initiative' },
      {} as any,
    )) as any;
    expect(kindOnly).toMatchObject({ kind: 'initiative', version: 2 });
  });

  it('supports CAS node/content writes and merge tombstones', async () => {
    const { store, source, target, tools } = await fixture();
    const updated = (await tools.knowledge_update_node!.execute?.(
      { node: target.id, expectedVersion: target.version, name: 'Project Atlas Prime' },
      {} as any,
    )) as any;
    expect(updated).toMatchObject({ name: 'Project Atlas Prime', version: 2 });

    const merged = (await tools.knowledge_merge_nodes!.execute?.(
      { sourceId: source.id, targetId: target.id, sourceVersion: source.version },
      {} as any,
    )) as any;
    expect(merged).toMatchObject({ id: target.id });
    expect(await store.getNode(source.id)).toBeNull();
    expect(await store.getNodeScopeIds(source.id)).toEqual([]);
    expect(await store.resolveNode({ name: source.name, scopeIds })).toBeNull();

    const page = (await tools.knowledge_write_node_content!.execute?.(
      { name: 'Atlas brief', content: 'Owned by [[Project Atlas Prime]].', scope: 'resource' },
      {} as any,
    )) as any;
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: 'Atlas brief', content: 'Missing CAS version.', scope: 'resource' },
        {} as any,
      ),
    ).rejects.toThrow('expectedVersion');
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: 'New node', content: 'Cannot create with a version.', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('only valid');
    const revised = (await tools.knowledge_write_node_content!.execute?.(
      {
        name: 'Atlas brief',
        content: 'Launch brief for [[Project Atlas Prime]].',
        scope: 'resource',
        expectedVersion: 1,
      },
      {} as any,
    )) as any;
    expect(revised).toMatchObject({ nodeId: page.nodeId, text: 'Launch brief for [[Project Atlas Prime]].' });
    expect(await store.getNode(page.nodeId)).toMatchObject({ version: 2 });
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: 'Atlas brief', content: 'stale', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('version');
  });

  it('bounds reserved guidance and never exposes restoration', async () => {
    const { tools } = await fixture();
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: ' Capture-Guidance ', content: 'x'.repeat(4_001), scope: 'resource' },
        {} as any,
      ),
    ).rejects.toThrow('limited');
    expect(Object.keys(tools)).toEqual([
      'knowledge_append',
      'knowledge_remove',
      'knowledge_update_node',
      'knowledge_merge_nodes',
      'knowledge_rescope',
      'knowledge_write_node_description',
      'knowledge_write_node_content',
    ]);
  });

  it('bounds node descriptions in UTF-16 code units with CAS and explicit clears', async () => {
    const { store, target, tools } = await fixture();
    const write = (description: string, expectedVersion: number) =>
      tools.knowledge_write_node_description!.execute?.({ node: target.id, expectedVersion, description }, {} as any);

    const limit = MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH;
    // Exactly at the limit: accepted.
    const atLimit = (await write('x'.repeat(limit), target.version)) as any;
    expect(atLimit).toMatchObject({ id: target.id, version: 2, metadata: { description: 'x'.repeat(limit) } });
    // One over: rejected by schema validation (maxLength counts code points).
    const schemaRejected = (await write('x'.repeat(limit + 1), 2)) as any;
    expect(schemaRejected).toMatchObject({ error: true });
    expect(schemaRejected.message).toContain(String(limit));
    // Astral characters: half as many emoji are half as many code points (schema passes) but exactly
    // `limit` UTF-16 units, which execute accepts.
    const emojiAtLimit = '😀'.repeat(limit / 2);
    expect(emojiAtLimit.length).toBe(limit);
    const astral = (await write(emojiAtLimit, 2)) as any;
    expect(astral).toMatchObject({ version: 3, metadata: { description: emojiAtLimit } });
    // One more emoji still passes the code-point schema but is 2 units over — execute is authoritative.
    await expect(write(`${emojiAtLimit}😀`, 3)).rejects.toThrow(`limited to ${limit}`);
    // Stale CAS rejected.
    await expect(write('stale write', 1)).rejects.toThrow('version');
    // Empty string is an explicit clear.
    const cleared = (await write('', 3)) as any;
    expect(cleared).toMatchObject({ version: 4, metadata: { description: '' } });
    expect(await store.getNode(target.id)).toMatchObject({ id: target.id, version: 4 });
    await expect(
      tools.knowledge_write_node_description!.execute?.(
        { node: 'missing-node', expectedVersion: 1, description: 'nope' },
        {} as any,
      ),
    ).rejects.toThrow('not found');
  });
});
