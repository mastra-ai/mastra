import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { formatVersion, getCurrentVersion, isVersionFlag } from './version.js';

it('reads the Mastra Code package version when running from source', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

  expect(getCurrentVersion()).toBe(pkg.version);
});

describe('isVersionFlag', () => {
  it('matches --version and -v as the first argument', () => {
    expect(isVersionFlag(['node', 'mastracode', '--version'])).toBe(true);
    expect(isVersionFlag(['node', 'mastracode', '-v'])).toBe(true);
  });

  it('does not match other invocations', () => {
    expect(isVersionFlag(['node', 'mastracode'])).toBe(false);
    expect(isVersionFlag(['node', 'mastracode', '--help'])).toBe(false);
    expect(isVersionFlag(['node', 'mastracode', '--prompt', '--version'])).toBe(false);
  });
});

it('formats the version like other coding CLIs', () => {
  expect(formatVersion('1.2.3')).toBe('mastracode 1.2.3');
});
