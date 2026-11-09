import { describe, expect, it } from 'vitest';
import { migratePersistedModelSelection } from './session';

describe('migratePersistedModelSelection', () => {
  it('stamps the version only after every legacy key is removed', async () => {
    const metadata: Record<string, unknown> = {
      currentModeId: 'build',
      currentModelId: 'openai/gpt-5.5',
      modeModelId_build: 'anthropic/claude-opus-4-6',
      modeModelId_plan: 'openai/gpt-5.2-codex',
    };
    let failPlanCleanup = true;
    const set = async (key: string, value: unknown) => {
      if (key === 'modeModelId_plan' && value === undefined && failPlanCleanup) {
        failPlanCleanup = false;
        throw new Error('cleanup failed');
      }
      if (value === undefined) delete metadata[key];
      else metadata[key] = value;
    };

    await expect(
      migratePersistedModelSelection({
        getMetadata: async () => ({ ...metadata }),
        modeId: 'build',
        set,
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('cleanup failed');

    expect(metadata.modelPersistenceVersion).toBeUndefined();
    expect(metadata.modeModelId_plan).toBe('openai/gpt-5.2-codex');

    await expect(
      migratePersistedModelSelection({
        getMetadata: async () => ({ ...metadata }),
        modeId: 'build',
        set,
        threadId: 'thread-1',
      }),
    ).resolves.toBe('anthropic/claude-opus-4-6');

    expect(metadata).toMatchObject({
      currentModelId: 'anthropic/claude-opus-4-6',
      modelPersistenceVersion: 2,
    });
    expect(metadata).not.toHaveProperty('modeModelId_build');
    expect(metadata).not.toHaveProperty('modeModelId_plan');
  });

  it('leaves metadata from a newer persistence format unchanged', async () => {
    const metadata: Record<string, unknown> = {
      currentModeId: 'build',
      currentModelId: 'openai/gpt-5.6',
      modelPersistenceVersion: 3,
      modeModelId_build: 'legacy-owned-by-newer-format',
    };
    const writes: Array<[string, unknown]> = [];

    await expect(
      migratePersistedModelSelection({
        metadata,
        modeId: 'build',
        set: async (key, value) => {
          writes.push([key, value]);
        },
      }),
    ).resolves.toBe('openai/gpt-5.6');

    expect(writes).toEqual([]);
  });
});
