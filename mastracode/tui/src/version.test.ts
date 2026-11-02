import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { formatVersion, getCurrentVersion, isVersionCommand } from './version.js';

it('reads the Mastra Code package version when running from source', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

  expect(getCurrentVersion()).toBe(pkg.version);
});

describe('isVersionCommand', () => {
  it('matches `mastracode --version`', () => {
    expect(isVersionCommand(['node', 'mastracode', '--version'])).toBe(true);
  });

  it('ignores other invocations', () => {
    expect(isVersionCommand(['node', 'mastracode'])).toBe(false);
    expect(isVersionCommand(['node', 'mastracode', '--help'])).toBe(false);
    expect(isVersionCommand(['node', 'mastracode', '-p', '--version'])).toBe(false);
  });
});

it('formats the version with the CLI name', () => {
  expect(formatVersion('1.2.3')).toBe('mastracode 1.2.3');
});
