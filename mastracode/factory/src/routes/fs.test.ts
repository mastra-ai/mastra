import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { SandboxFleet } from '../sandbox/fleet.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import {
  listArtifacts,
  listSessionRenderedPath,
  listWorkspaceRenderedPath,
  readSessionWorkspaceFile,
  readWorkspaceFile,
} from './fs.js';

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

// ── Session-backed (sandbox) workspace access ────────────────────────────────

const WORKDIR = '/workspaces/acme/repo';

function makeSession(overrides: Partial<SourceControlSession> = {}): SourceControlSession {
  return {
    id: 'row-1',
    sessionId: '0919fb96-a387-4407-bbf8-ccc563ef1391',
    projectRepositoryId: 'pr-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'main',
    baseBranch: 'main',
    sandboxId: 'sbx-1',
    sandboxWorkdir: WORKDIR,
    materializedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Fake fleet whose sandbox answers the exact shell scripts the session-backed
 * helpers issue (find listing, readlink/stat confinement checks, base64 read).
 */
function makeFleet(respond: (script: string) => { exitCode: number; stdout: string; stderr?: string }) {
  const executeCommand = vi.fn(async (_cmd: string, args?: string[]) => {
    const script = args?.[1] ?? '';
    const result = respond(script);
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr ?? '' };
  });
  const fleet = {
    enabled: true,
    reattachSandbox: vi.fn(async () => ({ id: 'sbx-1', executeCommand })),
  } as unknown as SandboxFleet;
  return { fleet, executeCommand };
}

describe('listSessionRenderedPath', () => {
  it('lists rendered entries from the session sandbox in one command', async () => {
    const { fleet, executeCommand } = makeFleet(script => {
      expect(script).toContain(`'${WORKDIR}/.artifacts'`);
      return {
        exitCode: 0,
        stdout: [
          `d\t0\t1700000000.0\t${WORKDIR}/.artifacts/understand-pr`,
          `f\t5\t1700000100.5\t${WORKDIR}/.artifacts/understand-pr/HISTORY.md`,
          '',
        ].join('\n'),
      };
    });

    const session = makeSession();
    const listing = await listSessionRenderedPath(fleet, session, '.artifacts');

    expect(listing.workspacePath).toBe(session.sessionId);
    expect(listing.root).toBe('.artifacts');
    expect(listing.rootPath).toBe(`${WORKDIR}/.artifacts`);
    expect(listing.entries).toEqual([
      expect.objectContaining({ name: 'understand-pr', path: 'understand-pr', type: 'directory', size: 0 }),
      expect.objectContaining({ name: 'HISTORY.md', path: 'understand-pr/HISTORY.md', type: 'file', size: 5 }),
    ]);
    expect(executeCommand).toHaveBeenCalledTimes(1);
  });

  it('returns an empty listing when the session has no sandbox binding', async () => {
    const { fleet, executeCommand } = makeFleet(() => ({ exitCode: 0, stdout: '' }));

    const listing = await listSessionRenderedPath(fleet, makeSession({ sandboxId: null }), '.artifacts');

    expect(listing.entries).toEqual([]);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('returns an empty listing when the sandbox can no longer be reattached', async () => {
    const { fleet, executeCommand } = makeFleet(() => ({ exitCode: 0, stdout: '' }));
    (fleet.reattachSandbox as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sandbox gone'));

    const listing = await listSessionRenderedPath(fleet, makeSession(), '.artifacts');

    expect(listing.entries).toEqual([]);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('returns an empty listing when the rendered root does not exist', async () => {
    const { fleet } = makeFleet(() => ({ exitCode: 0, stdout: '' }));

    const listing = await listSessionRenderedPath(fleet, makeSession(), '.artifacts');

    expect(listing.entries).toEqual([]);
  });

  it('rejects roots outside the approved allowlist without touching the sandbox', async () => {
    const { fleet, executeCommand } = makeFleet(() => ({ exitCode: 0, stdout: '' }));

    await expect(listSessionRenderedPath(fleet, makeSession(), '.ssh')).rejects.toThrow(
      'Root is not approved for rendered workspace access',
    );
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('ignores find output outside the rendered root', async () => {
    const { fleet } = makeFleet(() => ({
      exitCode: 0,
      stdout: `f\t5\t1700000000.0\t/etc/passwd\n`,
    }));

    const listing = await listSessionRenderedPath(fleet, makeSession(), '.artifacts');

    expect(listing.entries).toEqual([]);
  });
});

describe('readSessionWorkspaceFile', () => {
  function respondForFile(content: string) {
    const abs = `${WORKDIR}/.artifacts/understand-pr/HISTORY.md`;
    return (script: string) => {
      if (script.startsWith('readlink -f')) return { exitCode: 0, stdout: `${abs}\n` };
      if (script.startsWith('stat -c'))
        return { exitCode: 0, stdout: `regular file\t${content.length}\t1700000000\t0\n` };
      if (script.startsWith('base64 <'))
        return { exitCode: 0, stdout: Buffer.from(content, 'utf8').toString('base64') };
      return { exitCode: 1, stdout: '', stderr: `unexpected script: ${script}` };
    };
  }

  it('reads text content through the session sandbox', async () => {
    const { fleet } = makeFleet(respondForFile('# History'));

    const session = makeSession();
    const file = await readSessionWorkspaceFile(fleet, session, '.artifacts/understand-pr/HISTORY.md');

    expect(file).toEqual(
      expect.objectContaining({
        workspacePath: session.sessionId,
        path: '.artifacts/understand-pr/HISTORY.md',
        name: 'HISTORY.md',
        contentType: 'text',
        content: '# History',
        truncated: false,
      }),
    );
  });

  it('rejects reads outside approved rendered roots', async () => {
    const { fleet, executeCommand } = makeFleet(respondForFile('secret'));

    await expect(readSessionWorkspaceFile(fleet, makeSession(), '.ssh/config')).rejects.toThrow(
      'Root is not approved for rendered workspace access',
    );
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('rejects traversal outside the workspace', async () => {
    const { fleet } = makeFleet(respondForFile('secret'));

    await expect(readSessionWorkspaceFile(fleet, makeSession(), '../secret.md')).rejects.toThrow(
      'path escapes workspace',
    );
  });

  it('rejects directories', async () => {
    const { fleet } = makeFleet(script => {
      if (script.startsWith('readlink -f')) return { exitCode: 0, stdout: `${WORKDIR}/.artifacts\n` };
      if (script.startsWith('stat -c')) return { exitCode: 0, stdout: `directory\t0\t1700000000\t0\n` };
      return { exitCode: 1, stdout: '' };
    });

    await expect(readSessionWorkspaceFile(fleet, makeSession(), '.artifacts')).rejects.toThrow('Path is a directory');
  });

  it('errors when the session workspace is not materialized', async () => {
    const { fleet } = makeFleet(respondForFile('x'));

    await expect(
      readSessionWorkspaceFile(fleet, makeSession({ sandboxWorkdir: null }), '.artifacts/a.md'),
    ).rejects.toThrow('Session workspace is not available');
  });

  it('errors without re-provisioning when the sandbox can no longer be reattached', async () => {
    const { fleet } = makeFleet(respondForFile('x'));
    (fleet.reattachSandbox as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('sandbox gone'));

    await expect(readSessionWorkspaceFile(fleet, makeSession(), '.artifacts/a.md')).rejects.toThrow(
      'Session workspace is not available',
    );
  });
});
