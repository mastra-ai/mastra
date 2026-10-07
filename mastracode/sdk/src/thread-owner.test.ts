import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';

import { bootLocalAgentController } from './index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('Mastra Code thread ownership', () => {
  it('stamps the local owner on new threads and preserves owners across switches', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'mastracode-thread-owner-'));
    tempDirs.push(cwd);

    const { controller, ownerId, session } = await bootLocalAgentController({
      cwd,
      storage: new InMemoryStore(),
      storageBackend: 'libsql',
      disableEnvFile: true,
      disableHooks: true,
      disableMcp: true,
      disablePlugins: true,
      disableGithubSignals: true,
    });

    try {
      const firstThreadId = session.thread.getId();
      expect(firstThreadId).toBeTruthy();
      expect(await session.thread.getOwner()).toBe(ownerId);
      expect((await session.thread.getById({ threadId: firstThreadId! }))?.metadata).toMatchObject({
        ownerId,
        createdBy: ownerId,
      });

      await session.thread.transferOwnership({
        threadId: firstThreadId!,
        toOwnerId: 'transferred-owner',
        expectedOwnerId: ownerId,
      });
      const secondThread = await session.thread.create({ title: 'Second thread' });
      expect(await session.thread.getOwner()).toBe(ownerId);

      await session.thread.switch({ threadId: firstThreadId! });
      expect(await session.thread.getOwner()).toBe('transferred-owner');
      expect((await session.thread.getById({ threadId: firstThreadId! }))?.metadata).toMatchObject({
        ownerId: 'transferred-owner',
        createdBy: ownerId,
      });

      await session.thread.switch({ threadId: secondThread.id });
      expect(await session.thread.getOwner()).toBe(ownerId);
      expect((await session.thread.getById({ threadId: secondThread.id }))?.metadata).toMatchObject({
        ownerId,
        createdBy: ownerId,
      });
    } finally {
      await controller.destroy();
    }
  });
});
