import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listArtifacts, listWorkspaceRenderedPath, readWorkspaceFile } from './fs.js';

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

describe('listWorkspaceRenderedPath', () => {
  it('lists configured rendered roots with relative paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-rendered-root-'));
    const docs = join(root, 'workspace', '.artifacts', 'understand-pr');
    await mkdir(docs, { recursive: true });
    await writeFile(join(docs, 'HISTORY.md'), 'notes');

    const listing = await listWorkspaceRenderedPath(root, join(root, 'workspace'), '.artifacts');

    expect(listing.root).toBe('.artifacts');
    expect(listing.entries).toEqual([
      expect.objectContaining({ name: 'understand-pr', path: 'understand-pr', type: 'directory' }),
      expect.objectContaining({ name: 'HISTORY.md', path: 'understand-pr/HISTORY.md', type: 'file', size: 5 }),
    ]);
  });

  it('rejects a missing rendered root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-rendered-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    await expect(listWorkspaceRenderedPath(root, workspace, '')).rejects.toThrow('Missing required query param: root');
  });

  it('rejects traversal in the rendered root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-rendered-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    await expect(listWorkspaceRenderedPath(root, workspace, '../outside')).rejects.toThrow('root escapes workspace');
  });

  it('rejects roots outside the approved rendered-path allowlist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-rendered-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    await expect(listWorkspaceRenderedPath(root, workspace, '.ssh')).rejects.toThrow(
      'Root is not approved for rendered workspace access',
    );
  });

  it('does not follow symlink escapes in rendered roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-rendered-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'mc-rendered-outside-'));
    const artifacts = join(root, 'workspace', '.artifacts');
    await mkdir(artifacts, { recursive: true });
    await writeFile(join(outside, 'secret.md'), 'secret');
    await symlink(join(outside, 'secret.md'), join(artifacts, 'secret.md'));

    const listing = await listWorkspaceRenderedPath(root, join(root, 'workspace'), '.artifacts');

    expect(listing.entries).toEqual([]);
  });
});

describe('readWorkspaceFile', () => {
  it('reads bounded text content from a workspace-relative file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const file = join(root, 'workspace', '.artifacts', 'understand-pr', 'HISTORY.md');
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, '# History');

    const result = await readWorkspaceFile(root, join(root, 'workspace'), '.artifacts/understand-pr/HISTORY.md');

    expect(result).toEqual(
      expect.objectContaining({
        path: '.artifacts/understand-pr/HISTORY.md',
        name: 'HISTORY.md',
        contentType: 'text',
        content: '# History',
      }),
    );
  });

  it('rejects missing file paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    await expect(readWorkspaceFile(root, workspace, '')).rejects.toThrow('Missing required query param: path');
  });

  it('rejects directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const directory = join(root, 'workspace', '.artifacts');
    await mkdir(directory, { recursive: true });

    await expect(readWorkspaceFile(root, join(root, 'workspace'), '.artifacts')).rejects.toThrow('Path is a directory');
  });

  it('rejects traversal outside the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    await expect(readWorkspaceFile(root, workspace, '../secret.md')).rejects.toThrow('path escapes workspace');
  });

  it('rejects absolute file paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(workspace);

    await expect(readWorkspaceFile(root, workspace, join(workspace, '.artifacts', 'secret.md'))).rejects.toThrow(
      'path must be relative',
    );
  });

  it('rejects file reads outside approved rendered roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const workspace = join(root, 'workspace');
    await mkdir(join(workspace, '.ssh'), { recursive: true });
    await writeFile(join(workspace, '.ssh', 'config'), 'secret');

    await expect(readWorkspaceFile(root, workspace, '.ssh/config')).rejects.toThrow(
      'Root is not approved for rendered workspace access',
    );
  });

  it('rejects symlink escapes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mc-file-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'mc-file-outside-'));
    const artifacts = join(root, 'workspace', '.artifacts');
    await mkdir(artifacts, { recursive: true });
    await writeFile(join(outside, 'secret.md'), 'secret');
    await symlink(join(outside, 'secret.md'), join(artifacts, 'secret.md'));

    await expect(readWorkspaceFile(root, join(root, 'workspace'), '.artifacts/secret.md')).rejects.toThrow(
      'Path is outside the workspace',
    );
  });
});
