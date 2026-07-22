import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { MemoryLibSQL } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

import { TursoSqliteClient } from './client';
import { getTursoDatabaseSupport } from './support';

const support = getTursoDatabaseSupport();
const describeNative = support.supported ? describe : describe.skip;
const clients: TursoSqliteClient[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.allSettled(clients.splice(0).map(client => client.close()));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describeNative('Turso storage locking', () => {
  it('retries a domain write that encounters a temporary external write lock', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'mastra-turso-locking-'));
    directories.push(directory);
    const databasePath = path.join(directory, 'locking.db');
    const first = new TursoSqliteClient({ path: databasePath });
    const second = new TursoSqliteClient({ path: databasePath });
    clients.push(first, second);

    const firstMemory = new MemoryLibSQL({ client: first, maxRetries: 5, initialBackoffMs: 20 });
    const secondMemory = new MemoryLibSQL({ client: second, maxRetries: 5, initialBackoffMs: 20 });
    await firstMemory.init();
    await secondMemory.init();

    const transaction = await first.transaction('write');
    await transaction.execute({
      sql: 'INSERT INTO mastra_threads (id, resourceId, title, metadata, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['lock-holder', 'resource', 'Lock holder', '{}', new Date(), new Date()],
    });

    const save = secondMemory.saveThread({
      thread: {
        id: 'retried',
        resourceId: 'resource',
        title: 'Retried write',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    setTimeout(() => void transaction.commit(), 50);

    await expect(save).resolves.toMatchObject({ id: 'retried' });
    await expect(secondMemory.getThreadById({ threadId: 'retried' })).resolves.toMatchObject({
      title: 'Retried write',
    });
  });
});
