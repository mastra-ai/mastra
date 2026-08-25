import { InMemoryStore } from '@mastra/core/storage';
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
  it('keeps snapshots of all seven public input schemas', async () => {
    const { tools } = await fixture();
    expect(Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, tool.inputSchema]))).toMatchSnapshot();
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
      'knowledge_write_node_description',
      'knowledge_write_node_content',
    ]);
  });

  it('bounds node descriptions in UTF-16 code units with CAS and explicit clears', async () => {
    const { store, target, tools } = await fixture();
    const write = (description: string, expectedVersion: number) =>
      tools.knowledge_write_node_description!.execute?.({ node: target.id, expectedVersion, description }, {} as any);

    // Exactly at the limit: accepted.
    const atLimit = (await write('x'.repeat(500), target.version)) as any;
    expect(atLimit).toMatchObject({ id: target.id, version: 2, description: 'x'.repeat(500) });
    // One over: rejected by schema validation (maxLength counts code points).
    const schemaRejected = (await write('x'.repeat(501), 2)) as any;
    expect(schemaRejected).toMatchObject({ error: true });
    expect(schemaRejected.message).toContain('500');
    // Astral characters: 250 emoji = 250 code points (schema passes) = 500 UTF-16 units (execute accepts).
    const emoji250 = '😀'.repeat(250);
    expect(emoji250.length).toBe(500);
    const astral = (await write(emoji250, 2)) as any;
    expect(astral).toMatchObject({ version: 3, description: emoji250 });
    // 251 emoji = 251 code points (schema passes) but 502 UTF-16 units — the execute check is authoritative.
    await expect(write('😀'.repeat(251), 3)).rejects.toThrow('limited to 500');
    // Stale CAS rejected.
    await expect(write('stale write', 1)).rejects.toThrow('version');
    // Empty string is an explicit clear.
    const cleared = (await write('', 3)) as any;
    expect(cleared).toMatchObject({ version: 4, description: '' });
    // Content untouched throughout; tool never creates nodes.
    expect((await store.getNode(target.id))?.content).toBe(target.content);
    await expect(
      tools.knowledge_write_node_description!.execute?.(
        { node: 'missing-node', expectedVersion: 1, description: 'nope' },
        {} as any,
      ),
    ).rejects.toThrow('not found');
  });
});
