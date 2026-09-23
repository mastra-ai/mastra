import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { gitRepositoryRoot, privateDirectoryConfiguration } from '../../src/private-directory.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function monorepo() {
  const root = await mkdtemp(join(tmpdir(), 'demo-private-monorepo-'));
  directories.push(root);
  await writeFile(join(root, '.git'), 'gitdir: /synthetic/worktree\n');
  const template = join(root, 'templates', 'customer-refund');
  await mkdir(template, { recursive: true });
  return { root, template };
}

describe('private demo directory', () => {
  it('finds a worktree .git file and defaults outside the enclosing monorepo', async () => {
    const { root, template } = await monorepo();
    const canonicalRoot = await realpath(root);
    expect(await gitRepositoryRoot(template)).toBe(canonicalRoot);
    await expect(privateDirectoryConfiguration({ templateRoot: template })).resolves.toMatchObject({
      repository: canonicalRoot,
      requested: join(canonicalRoot, '..', 'demo-private'),
    });
  });

  it('rejects direct and symlink aliases inside the enclosing Git repository before setup can create files', async () => {
    const { root, template } = await monorepo();
    const outside = await mkdtemp(join(tmpdir(), 'demo-private-outside-'));
    directories.push(outside);
    await symlink(root, join(outside, 'repository-link'));

    await expect(
      privateDirectoryConfiguration({
        templateRoot: template,
        requestedDirectory: join(root, 'credentials'),
      }),
    ).rejects.toThrow('outside the Git repository');
    await expect(
      privateDirectoryConfiguration({
        templateRoot: template,
        requestedDirectory: join(outside, 'repository-link', 'credentials'),
      }),
    ).rejects.toThrow('outside the Git repository');
  });
});
