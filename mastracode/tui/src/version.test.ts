import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { getCurrentVersion, isVersionCommand } from './version.js';

it('reads the Mastra Code package version when running from source', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

  expect(getCurrentVersion()).toBe(pkg.version);
});

describe('isVersionCommand', () => {
  it('matches `mastracode --version` and `mastracode -v`', () => {
    expect(isVersionCommand(['node', 'mastracode', '--version'])).toBe(true);
    expect(isVersionCommand(['node', 'mastracode', '-v'])).toBe(true);
  });

  it('ignores other invocations', () => {
    expect(isVersionCommand(['node', 'mastracode'])).toBe(false);
    expect(isVersionCommand(['node', 'mastracode', '--help'])).toBe(false);
    expect(isVersionCommand(['node', 'mastracode', '-p', '--version'])).toBe(false);
  });
});
