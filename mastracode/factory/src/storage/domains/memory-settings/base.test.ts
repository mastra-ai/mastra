import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

describe('MemorySettingsStorage', () => {
  it('creates a row on first patch and scopes reads to (org, user)', async () => {
    const seed = await createFactoryStorageForTests();

    const record = await seed.memorySettings.patch({
      orgId: 'org-1',
      userId: 'user-1',
      patch: { observerModelId: 'google/gemini-3-flash', observationThreshold: 30000 },
    });

    expect(record).toMatchObject({
      orgId: 'org-1',
      userId: 'user-1',
      observerModelId: 'google/gemini-3-flash',
      reflectorModelId: null,
      observationThreshold: 30000,
      reflectionThreshold: null,
      observeAttachments: null,
    });
    expect(await seed.memorySettings.get({ orgId: 'org-1', userId: 'user-1' })).toEqual(record);
    expect(await seed.memorySettings.get({ orgId: 'other-org', userId: 'user-1' })).toBeNull();
    expect(await seed.memorySettings.get({ orgId: 'org-1', userId: 'other-user' })).toBeNull();
  });

  it('patches only the provided knobs on subsequent writes', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.memorySettings.patch({
      orgId: 'org-1',
      userId: 'user-1',
      patch: { observerModelId: 'google/gemini-3-flash', reflectorModelId: 'anthropic/claude-haiku-4-5' },
    });
    const updated = await seed.memorySettings.patch({
      orgId: 'org-1',
      userId: 'user-1',
      patch: { reflectionThreshold: 50000, observeAttachments: true },
    });

    expect(updated).toMatchObject({
      observerModelId: 'google/gemini-3-flash',
      reflectorModelId: 'anthropic/claude-haiku-4-5',
      observationThreshold: null,
      reflectionThreshold: 50000,
      observeAttachments: true,
    });
  });

  it('round-trips the observe-attachments tri-state', async () => {
    const seed = await createFactoryStorageForTests();

    for (const value of ['auto', true, false] as const) {
      const record = await seed.memorySettings.patch({
        orgId: 'org-1',
        userId: 'user-1',
        patch: { observeAttachments: value },
      });
      expect(record.observeAttachments).toBe(value);
      expect((await seed.memorySettings.get({ orgId: 'org-1', userId: 'user-1' }))?.observeAttachments).toBe(value);
    }
  });

  it('keeps rows independent per user within an org', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.memorySettings.patch({ orgId: 'org-1', userId: 'user-1', patch: { observationThreshold: 10000 } });
    await seed.memorySettings.patch({ orgId: 'org-1', userId: 'user-2', patch: { observationThreshold: 20000 } });

    expect((await seed.memorySettings.get({ orgId: 'org-1', userId: 'user-1' }))?.observationThreshold).toBe(10000);
    expect((await seed.memorySettings.get({ orgId: 'org-1', userId: 'user-2' }))?.observationThreshold).toBe(20000);
  });
});
