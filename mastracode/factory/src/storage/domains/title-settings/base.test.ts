import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

describe('TitleSettingsStorage', () => {
  it('creates a row on first patch and scopes reads to the org', async () => {
    const seed = await createFactoryStorageForTests();

    const record = await seed.titleSettings.patch({
      orgId: 'org-1',
      patch: { enabled: false, modelId: 'google/gemini-2.5-flash' },
    });

    expect(record).toMatchObject({
      orgId: 'org-1',
      enabled: false,
      modelId: 'google/gemini-2.5-flash',
      thinkingLevel: null,
    });
    expect(await seed.titleSettings.get({ orgId: 'org-1' })).toEqual(record);
    expect(await seed.titleSettings.get({ orgId: 'other-org' })).toBeNull();
  });

  it('patches only the provided knobs and clears others with null', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.titleSettings.patch({ orgId: 'org-1', patch: { enabled: false, modelId: 'openai/gpt-5.4-mini' } });
    const updated = await seed.titleSettings.patch({
      orgId: 'org-1',
      patch: { enabled: true, modelId: null, thinkingLevel: 'low' },
    });

    expect(updated).toMatchObject({ enabled: true, modelId: null, thinkingLevel: 'low' });
  });
});
