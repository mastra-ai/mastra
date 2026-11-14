import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { sourceDigest } from '../scripts/source-digest.js';

test('source digest binds the executable example target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scanner-source-digest-'));
  try {
    for (const name of [
      'package.json',
      'tsconfig.json',
      'vitest.config.ts',
      'README.md',
      'CONTRIBUTING.md',
      '.env.example',
      '.gitignore',
      '.nvmrc',
      '.oxfmtrc.json',
    ])
      await writeFile(join(root, name), '');
    for (const name of ['src', 'scripts', 'tests', 'docker', 'web', 'references', 'docs', 'example-target-api'])
      await mkdir(join(root, name));
    const example = join(root, 'example-target-api', 'transport.ts');
    await writeFile(example, 'first');
    const before = await sourceDigest(root);
    await writeFile(example, 'second');
    expect(await sourceDigest(root)).not.toBe(before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
