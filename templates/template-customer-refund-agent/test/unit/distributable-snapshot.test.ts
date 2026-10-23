import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertNoDistributedWhitespace,
  createDistributableSnapshot,
  distributableFingerprint,
} from '../../scripts/distributable-snapshot.mjs';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'distributable-snapshot-'));
  directories.push(root);
  await Promise.all([
    ...['client-demo-ui', 'config', 'docs', 'evals', 'scripts', 'src', 'support-demo-ui', 'test'].map(
      async directory => {
        await mkdir(join(root, directory), { recursive: true });
        await writeFile(join(root, directory, '.keep'), '');
      },
    ),
    ...[
      '.env.example',
      '.gitignore',
      '.npmrc',
      '.nvmrc',
      '.oxfmtrc.json',
      'LICENSE',
      'README.md',
      'CONTRIBUTING.md',
      'package.json',
      'package-lock.json',
      'playwright.config.ts',
      'tsconfig.json',
      'vitest.config.ts',
    ].map(file => writeFile(join(root, file), 'fixture\n')),
    writeFile(join(root, '.env'), 'OPENAI_API_KEY=must-not-copy\n'),
    writeFile(join(root, 'src', '.env.local'), 'must-not-copy\n'),
    writeFile(join(root, 'test', 'private.db-wal'), 'must-not-copy\n'),
  ]);
  return root;
}

describe('distributable snapshot', () => {
  it('copies only the allowlisted distributable files without requiring Git', async () => {
    const root = await fixture();
    const snapshot = await createDistributableSnapshot(root);
    directories.push(snapshot.destination);
    await expect(readFile(join(snapshot.destination, 'README.md'), 'utf8')).resolves.toBe('fixture\n');
    await expect(access(join(snapshot.destination, '.env'))).rejects.toThrow();
    await expect(access(join(snapshot.destination, 'src', '.env.local'))).rejects.toThrow();
    await expect(access(join(snapshot.destination, 'test', 'private.db-wal'))).rejects.toThrow();
  });

  it('fingerprints whitespace changes and rejects them before the clean runner starts', async () => {
    const root = await fixture();
    const initial = await distributableFingerprint(root);
    await writeFile(join(root, 'README.md'), 'fixture  \n');
    expect(await distributableFingerprint(root)).not.toBe(initial);
    await expect(assertNoDistributedWhitespace(root)).rejects.toThrow('README.md:1 trailing whitespace');
  });

  it('fails before copying an allowed symlink', async () => {
    const root = await fixture();
    await symlink('README.md', join(root, 'docs', 'linked-readme.md'));
    await expect(createDistributableSnapshot(root)).rejects.toThrow('rejects symlink');
  });
});
