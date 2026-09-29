import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from '@lancedb/lancedb';
import { Field, Float64, Schema, Utf8 } from 'apache-arrow';
import { afterEach, describe, expect, it } from 'vitest';
import { LanceStorage } from '../../index';

describe('Lance threads archivedAt migration', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('adds archivedAt to a legacy threads table and reads old rows as non-archived', async () => {
    dir = mkdtempSync(join(tmpdir(), 'lance-archived-'));
    const client = await connect(dir);
    const legacy = await client.createEmptyTable(
      'mastra_threads',
      new Schema([
        new Field('id', new Utf8(), true),
        new Field('resourceId', new Utf8(), true),
        new Field('title', new Utf8(), true),
        new Field('metadata', new Utf8(), true),
        new Field('createdAt', new Float64(), true),
        new Field('updatedAt', new Float64(), true),
      ]),
    );
    const ts = new Date('2024-01-01T00:00:00.000Z').getTime();
    await legacy.add([{ id: 'legacy', resourceId: 'r', title: 't', metadata: '{}', createdAt: ts, updatedAt: ts }]);

    const store = await LanceStorage.create('lance-migration', 'LanceMigration', dir);
    const memory = await store.getStore('memory');
    await memory!.init();

    const reopened = await client.openTable('mastra_threads');
    expect(await reopened.schema().then(s => s.fields.some(f => f.name === 'archivedAt'))).toBe(true);
    expect((await memory!.getThreadById({ threadId: 'legacy' }))?.archivedAt).toBeNull();
    const active = await memory!.listThreads({ filter: { resourceId: 'r', archived: false } });
    expect(active.threads.map(t => t.id)).toEqual(['legacy']);

    await memory!.updateThread({ id: 'legacy', title: 't', archivedAt: new Date(ts) });
    const archived = await memory!.listThreads({ filter: { resourceId: 'r', archived: true } });
    expect(archived.threads[0]?.archivedAt?.getTime()).toBe(ts);
  });
});
