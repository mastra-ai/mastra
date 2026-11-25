import { describe, expect, it } from 'vitest';

import { upsertCustomProviderInSettings } from '../custom-providers.js';
import { parseCustomProviders } from '../settings.js';
import type { GlobalSettings } from '../settings.js';

describe('upsertCustomProviderInSettings', () => {
  it('saves typed header names and values trimmed, as settings.json reads them back', () => {
    const settings = { customProviders: [] } as unknown as GlobalSettings;

    upsertCustomProviderInSettings(settings, {
      name: 'Gateway',
      url: 'https://gateway.example.com/v1',
      authScheme: 'x-api-key',
      headers: [{ name: ' X-Org-Id ', value: ' org-1 ', secret: false }],
      models: ['model-1'],
    });

    const saved = settings.customProviders[0];
    expect(saved?.headers).toEqual([{ name: 'X-Org-Id', value: 'org-1', secret: false }]);
    expect(parseCustomProviders(JSON.parse(JSON.stringify(settings.customProviders)))).toEqual([saved]);
  });
});
