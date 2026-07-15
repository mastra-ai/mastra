import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../..';
import { createKnowledgeWriteTools } from '../../processors/observational-memory/subconscious/knowledge-write-tools';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

async function fixture() {
  const memory = new Memory({ storage: new InMemoryStore() });
  const store = (await memory.storage.getStore('knowledge'))!;
  const source = await store.createEntity({ name: 'Atlas Initiative', kind: 'project', scope });
  const target = await store.createEntity({ name: 'Project Atlas', kind: 'project', scope });
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

  it('supports CAS entity/page writes and merge tombstones', async () => {
    const { store, source, target, tools } = await fixture();
    const updated = (await tools.knowledge_update_entity!.execute?.(
      { entityId: target.id, expectedVersion: target.version, name: 'Project Atlas Prime' },
      {} as any,
    )) as any;
    expect(updated).toMatchObject({ name: 'Project Atlas Prime', version: 2 });
    expect(
      await tools.knowledge_update_entity!.execute?.(
        { entityId: target.id, expectedVersion: updated.version, kind: ' page ' },
        {} as any,
      ),
    ).toMatchObject({ error: true, message: expect.stringMatching(/pattern/) });

    const merged = (await tools.knowledge_merge_entities!.execute?.(
      { sourceId: source.id, targetId: target.id, sourceVersion: source.version },
      {} as any,
    )) as any;
    expect(merged).toMatchObject({ id: target.id });
    expect(await store.getEntity(source.id)).toMatchObject({ mergedInto: target.id });
    expect(await store.resolveEntity({ name: source.name, scope })).toMatchObject({ id: target.id });

    const page = (await tools.knowledge_write_page!.execute?.(
      { name: 'Atlas brief', body: 'Owned by [[Project Atlas Prime]].', scope: 'resource' },
      {} as any,
    )) as any;
    await expect(
      tools.knowledge_write_page!.execute?.(
        { name: page.name, body: 'Missing CAS version.', scope: 'resource' },
        {} as any,
      ),
    ).rejects.toThrow('expectedVersion');
    await expect(
      tools.knowledge_write_page!.execute?.(
        { name: 'New page', body: 'Cannot create with a version.', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('only valid');
    const revised = (await tools.knowledge_write_page!.execute?.(
      { name: page.name, body: 'Launch brief for [[Project Atlas Prime]].', scope: 'resource', expectedVersion: 1 },
      {} as any,
    )) as any;
    expect(revised).toMatchObject({ type: 'page', version: 2 });
    await expect(
      tools.knowledge_write_page!.execute?.(
        { name: page.name, body: 'stale', scope: 'resource', expectedVersion: 1 },
        {} as any,
      ),
    ).rejects.toThrow('version');
  });

  it('bounds reserved guidance and never exposes restoration', async () => {
    const { tools } = await fixture();
    await expect(
      tools.knowledge_write_page!.execute?.(
        { name: ' Capture-Guidance ', body: 'x'.repeat(8_001), scope: 'resource' },
        {} as any,
      ),
    ).rejects.toThrow('limited');
    expect(Object.keys(tools)).toEqual([
      'knowledge_add_fact',
      'knowledge_remove_fact',
      'knowledge_update_entity',
      'knowledge_merge_entities',
      'knowledge_rescope',
      'knowledge_write_page',
    ]);
  });
});
