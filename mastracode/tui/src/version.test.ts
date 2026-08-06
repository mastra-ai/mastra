import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

import { getCurrentVersion } from './version.js';

it('reads the Mastra Code package version when running from source', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

  expect(getCurrentVersion()).toBe(pkg.version);
});
