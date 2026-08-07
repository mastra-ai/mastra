import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FilesystemDB } from '../../filesystem-db';
import { FilesystemAgentsStorage } from './filesystem';

describe('FilesystemAgentsStorage', () => {
  let storageDir: string | undefined;

  afterEach(() => {
    if (storageDir) {
      rmSync(storageDir, { recursive: true, force: true });
      storageDir = undefined;
    }
  });

  it('stores unknown agents in the shared agents file', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    storage.__registerMastra({
      getAgentById: () => {
        throw new Error('Agent with id stored-agent not found');
      },
    } as any);

    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Help users.',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const version = await storage.getLatestVersion('stored-agent');

    await storage.update({ id: 'stored-agent', status: 'published', activeVersionId: version?.id });

    const agentsFile = JSON.parse(readFileSync(join(storageDir, 'agents.json'), 'utf-8'));
    expect(agentsFile['stored-agent']).toMatchObject({
      name: 'Stored Agent',
      instructions: 'Help users.',
      model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
    });
    expect(existsSync(join(storageDir, 'agents', 'stored-agent.json'))).toBe(false);
  });

  it('rethrows unexpected code-agent lookup failures', async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'mastra-agents-storage-'));
    const storage = new FilesystemAgentsStorage({ db: new FilesystemDB(storageDir) });
    storage.__registerMastra({
      getAgentById: () => {
        throw new Error('registry unavailable');
      },
    } as any);

    await storage.init();
    await storage.create({
      agent: {
        id: 'stored-agent',
        name: 'Stored Agent',
        instructions: 'Help users.',
        model: { provider: 'openai', name: '__AI_SDK_OPENAI_MODEL_BASE__' },
      },
    });
    const version = await storage.getLatestVersion('stored-agent');

    await expect(
      storage.update({ id: 'stored-agent', status: 'published', activeVersionId: version?.id }),
    ).rejects.toThrow('registry unavailable');
  });
});
