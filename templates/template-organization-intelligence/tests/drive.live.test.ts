import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadCatalog } from '../src/mastra/workspaces/catalog.js';
import { createSourceRuntime } from '../src/mastra/workspaces/sources.js';

const catalogPath = fileURLToPath(new URL('../source-catalog.json', import.meta.url));
const ledgerPath = fileURLToPath(new URL('../.cache/live-source-identities.json', import.meta.url));

describe('live Google Drive smoke', () => {
  it('reads the agreed synthetic f1-Drive-smoke.txt record from every enabled Drive source', async () => {
    const catalog = await loadCatalog(catalogPath);
    const runtime = await createSourceRuntime({ catalog, catalogPath, ledgerPath });
    const driveSources = catalog.sources.filter(source => source.enabled && source.provider === 'google-drive');
    expect(
      driveSources,
      'Enable configured synthetic Google Drive sources before running this live smoke.',
    ).not.toHaveLength(0);

    for (const source of driveSources) {
      const result = await runtime.inspect(source.id, 'f1-drive-smoke.txt');
      expect(result.status).toBe('available');
      expect(result.content).toContain(`source=${source.id}`);
    }
  });
});
