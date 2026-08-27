import { InMemoryStore } from '@mastra/core/storage';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { describe, expect, it } from 'vitest';

import { Memory } from '../..';
import { createKnowledgeWriteTools } from '../../processors/observational-memory/subconscious/knowledge-write-tools';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

async function fixture() {
  const memory = new Memory({ storage: new InMemoryStore() });
  const store = (await memory.storage.getStore('knowledge'))!;
  const source = await store.createNode({ name: 'Atlas Initiative', kind: 'project', scope });
  const target = await store.createNode({ name: 'Project Atlas', kind: 'project', scope });
  const tools = createKnowledgeWriteTools(memory, {
    scope,
    sourceThreadId: 'alpha',
    defaultScope: 'resource',
    maxScope: 'resource',
  });
  return { store, source, target, tools };
}

describe('Subconscious knowledge write tools', () => {
  it('keeps snapshots of all six public input schemas', async () => {
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
    expect(await store.getNode(source.id)).toMatchObject({ mergedInto: target.id });
    expect(await store.resolveNode({ name: source.name, scope })).toMatchObject({ id: target.id });

    const page = (await tools.knowledge_write_node_content!.execute?.(
      { name: 'Atlas brief', content: 'Owned by [[Project Atlas Prime]].', scope: 'resource' },
      {} as any,
    )) as any;
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: page.name, content: 'Missing CAS version.', scope: 'resource' },
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
      { name: page.name, content: 'Launch brief for [[Project Atlas Prime]].', scope: 'resource', expectedVersion: 1 },
      {} as any,
    )) as any;
    expect(revised).toMatchObject({ type: 'node', version: 2 });
    await expect(
      tools.knowledge_write_node_content!.execute?.(
        { name: page.name, content: 'stale', scope: 'resource', expectedVersion: 1 },
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
      'knowledge_write_node_content',
    ]);
  });
});
