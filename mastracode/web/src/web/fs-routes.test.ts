import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listArtifacts } from './fs-routes.js';

describe('listArtifacts', () => {
  it('returns an empty list when .artifacts does not exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-artifacts-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    const listing = await listArtifacts(root, workspace);
    const realWorkspace = await realpath(workspace);

    expect(listing.rootPath).toBe(realWorkspace);
    expect(listing.artifactsPath).toBe(join(realWorkspace, '.artifacts'));
    expect(listing.entries).toEqual([]);
  });

  it('lists files under .artifacts with relative paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-artifacts-root-'));
    const artifacts = join(root, 'workspace', '.artifacts');
    await mkdir(join(artifacts, 'understand-pr'), { recursive: true });
    await writeFile(join(artifacts, 'understand-pr', 'HISTORY.md'), 'notes');

    const listing = await listArtifacts(root, join(root, 'workspace'));

    expect(listing.entries).toEqual([
      expect.objectContaining({ name: 'understand-pr', path: 'understand-pr', type: 'directory' }),
      expect.objectContaining({ name: 'HISTORY.md', path: 'understand-pr/HISTORY.md', type: 'file', size: 5 }),
    ]);
  });

  it('rejects paths outside the browsable root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-artifacts-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'mc-artifacts-outside-'));

    await expect(listArtifacts(root, outside)).rejects.toThrow('Path is outside the browsable root');
  });

  it('does not follow symlinks inside .artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-artifacts-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'mc-artifacts-outside-'));
    const artifacts = join(root, 'workspace', '.artifacts');
    await mkdir(artifacts, { recursive: true });
    await writeFile(join(outside, 'secret.md'), 'secret');
    await symlink(join(outside, 'secret.md'), join(artifacts, 'secret.md'));

    const listing = await listArtifacts(root, join(root, 'workspace'));

    expect(listing.entries).toEqual([]);
  });
});
