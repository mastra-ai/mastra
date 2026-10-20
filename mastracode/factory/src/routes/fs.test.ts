import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { LocalFilesystem } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __clearSessionSandboxesForTests, getSessionSandbox } from '../sandbox/session-sandbox.js';
import {
  __clearSessionEnvironmentsForTests,
  recordSessionEnvironment,
} from '../session/environment-state-processor.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});
import {
  buildFsRoutes,
  listArtifacts,
  listSessionWorkspaceTree,
  listSessionRenderedPath,
  listSessionWorkspaceChanges,
  listWorkspaceRenderedPath,
  parseWorkspaceChanges,
  parseWorkspaceChangeStats,
  parseWorkspaceTrackedChanges,
  readSessionWorkspaceDiff,
  readSessionWorkspaceFile,
  readWorkspaceFile,
} from './fs.js';

const execFileAsync = promisify(execFile);

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
const BASE_SHA = '0123456789abcdef0123456789abcdef01234567';

function makeSession(overrides: Partial<SourceControlSession> = {}): SourceControlSession {
  return {
    id: 'row-1',
    sessionId: '0919fb96-a387-4407-bbf8-ccc563ef1391',
    projectRepositoryId: 'pr-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'main',
    title: null,
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
 * Seed the per-process session memo with a fake sandbox that answers the
 * exact shell scripts the session-backed helpers issue (find listing,
 * readlink/stat confinement checks, base64 read). The session read path
 * resolves through the memo only — it never constructs.
 */
function seedSessionSandbox(
  respond: (script: string, command: string, args: string[]) => { exitCode: number; stdout: string; stderr?: string },
  {
    sessionRowId = 'row-1',
    workdir = WORKDIR,
    comparisonBase = BASE_SHA,
    trackedChanges,
    filesystem,
  }: {
    sessionRowId?: string;
    workdir?: string;
    comparisonBase?: string;
    trackedChanges?: string;
    filesystem?: unknown;
  } = {},
) {
  const executeCommand = vi.fn(
    async (command: string, args: string[] = [], _options?: { maxRetainedBytes?: number }) => {
      if (command === 'git' && args[2] === 'merge-base') {
        return { exitCode: 0, stdout: comparisonBase + '\n', stderr: '' };
      }
      if (command === 'git' && args[2] === 'diff' && args.includes('--name-status')) {
        return trackedChanges === undefined
          ? { exitCode: 1, stdout: '', stderr: 'tracked diff not configured' }
          : { exitCode: 0, stdout: trackedChanges, stderr: '' };
      }
      const script = args[1] ?? '';
      const result = respond(script, command, args);
      return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr ?? '' };
    },
  );
  // The memo derives the workdir from the constructed instance: a local
  // provider checks out under <workingDirectory>/<repo name>.
  getSessionSandbox(
    sessionRowId,
    'acme/repo',
    () =>
      ({
        id: 'sbx-1',
        provider: 'local',
        workingDirectory: workdir.slice(0, workdir.lastIndexOf('/')),
        executeCommand,
        ...(filesystem !== undefined && { filesystem }),
      }) as never,
  );
  return { executeCommand };
}

function makeSessionFs({ session = makeSession() }: { session?: SourceControlSession } = {}) {
  const ensureUser = vi.fn(async () => undefined);
  return {
    ensureUser,
    deps: {
      auth: {
        enabled: () => true,
        ensureUser,
        tenant: () => ({ orgId: session.orgId, userId: session.userId }),
        isOrganizationAdmin: async () => false,
      },
      sessions: { getBySessionId: vi.fn(async () => session) },
    },
  };
}

async function requestSessionRoute(path: string, sessionFs: ReturnType<typeof makeSessionFs>['deps']) {
  const route = buildFsRoutes({ sessionFs }).find(candidate => candidate.path === path);
  if (!route || !('handler' in route)) throw new Error(`Missing route: ${path}`);

  const app = new Hono<any>();
  app.get('/', context => route.handler(context as never, async () => {}));
  return (query: string) => app.request(`http://localhost/${query}`);
}

/**
 * A real git checkout on the host behind a sandbox whose commands run on the
 * host and whose native filesystem is the host's, so the tree and file routes
 * run real `git check-ignore`, real directory listings and real symlink checks.
 */
async function seedHostCheckouts(repos: string[] = ['acme/repo']) {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'factory-tree-')));
  for (const slug of repos) {
    const dir = join(parent, slug.split('/')[1]!);
    await mkdir(join(dir, 'src', 'nested'), { recursive: true });
    await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true });
    await mkdir(join(dir, 'dist'), { recursive: true });
    await writeFile(join(dir, '.gitignore'), '.env\nnode_modules\ndist/\n');
    await writeFile(join(dir, '.env'), 'TOKEN=secret');
    await writeFile(join(dir, 'README.md'), `# ${slug}`);
    await writeFile(join(dir, 'src', 'agent.ts'), 'export const agent = 1;\n');
    await writeFile(join(dir, 'src', 'nested', 'deep.ts'), '');
    await writeFile(join(dir, 'node_modules', 'pkg', 'index.js'), '');
    await writeFile(join(dir, 'dist', 'out.js'), '');
    await execFileAsync('git', ['init', '-q', dir]);
  }
  const executeCommand = vi.fn(async (command: string, args: string[] = [], options?: { cwd?: string }) => {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { cwd: options?.cwd ?? parent });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      const failed = error as { code?: number; stdout?: string; stderr?: string };
      return {
        exitCode: typeof failed.code === 'number' ? failed.code : 1,
        stdout: failed.stdout ?? '',
        stderr: failed.stderr ?? '',
      };
    }
  });
  const filesystem = new LocalFilesystem({ basePath: '/', contained: false });
  getSessionSandbox(
    'row-1',
    repos[0]!,
    () => ({ id: 'sbx-1', provider: 'local', workingDirectory: parent, executeCommand, filesystem }) as never,
    repos.length > 1 ? repos : undefined,
  );
  return { parent, executeCommand };
}

describe('live session file tree', () => {
  const names = (listing: { entries: Array<{ name: string; type: string }> }) =>
    listing.entries.map(entry => `${entry.type === 'directory' ? 'd' : 'f'} ${entry.name}`);

  it('lists one directory, folders first, without git internals or ignored entries', async () => {
    await seedHostCheckouts();

    const top = await listSessionWorkspaceTree(makeSession());
    expect(top.available).toBe(true);
    expect(names(top)).toEqual(['d src', 'f .gitignore', 'f README.md']);

    const src = await listSessionWorkspaceTree(makeSession(), 'src');
    expect(src.entries).toEqual([
      { name: 'nested', path: 'src/nested', type: 'directory' },
      { name: 'agent.ts', path: 'src/agent.ts', type: 'file', size: 24 },
    ]);
  });

  it('refuses to list or read ignored paths and git internals', async () => {
    await seedHostCheckouts();

    for (const path of ['node_modules', 'node_modules/pkg', 'dist', '.git', '.git/objects']) {
      await expect(listSessionWorkspaceTree(makeSession(), path)).rejects.toThrow('not available');
    }
    for (const path of ['.env', 'dist/out.js', '.git/config', 'node_modules/pkg/index.js']) {
      await expect(readSessionWorkspaceFile(makeSession(), path)).rejects.toThrow('not available');
    }
  });

  it('checks odd filenames exactly, with nothing read as shell', async () => {
    const { parent } = await seedHostCheckouts();
    await writeFile(join(parent, 'repo', '.gitignore'), `.env\n*.log\n`);
    await writeFile(join(parent, 'repo', `it's "odd" $(touch pwned) é.log`), '');
    await writeFile(join(parent, 'repo', `it's "kept" $(touch pwned) é.md`), '');

    const names = (await listSessionWorkspaceTree(makeSession())).entries.map(entry => entry.name);

    expect(names).toContain(`it's "kept" $(touch pwned) é.md`);
    expect(names).not.toContain(`it's "odd" $(touch pwned) é.log`);
    expect(names).not.toContain('pwned');
  });

  it('reads any listed checkout file', async () => {
    await seedHostCheckouts();

    await expect(readSessionWorkspaceFile(makeSession(), 'src/agent.ts')).resolves.toMatchObject({
      path: 'src/agent.ts',
      content: 'export const agent = 1;\n',
      contentType: 'text',
    });
  });

  it('refuses a file whose symlink leads outside the checkout', async () => {
    const { parent } = await seedHostCheckouts();
    const outside = await mkdtemp(join(tmpdir(), 'factory-tree-outside-'));
    await writeFile(join(outside, 'secret.txt'), 'secret');
    await symlink(join(outside, 'secret.txt'), join(parent, 'repo', 'src', 'link.txt'));

    await expect(readSessionWorkspaceFile(makeSession(), 'src/link.txt')).rejects.toThrow('symlink');
  });

  it('lists the whole working directory of a multi-repository session, then each checkout', async () => {
    const { parent, executeCommand } = await seedHostCheckouts(['acme/repo', 'acme/docs']);
    await mkdir(join(parent, 'notes'));
    await writeFile(join(parent, 'notes', 'setup.log'), 'installed');
    await mkdir(join(parent, '.git'));

    const top = await listSessionWorkspaceTree(makeSession());
    expect(top.entries).toEqual([
      { name: 'docs', path: 'docs', type: 'directory' },
      { name: 'notes', path: 'notes', type: 'directory' },
      { name: 'repo', path: 'repo', type: 'directory' },
    ]);
    // Outside a checkout there is no .gitignore to apply.
    executeCommand.mockClear();
    expect(names(await listSessionWorkspaceTree(makeSession(), 'notes'))).toEqual(['f setup.log']);
    await expect(readSessionWorkspaceFile(makeSession(), 'notes/setup.log')).resolves.toMatchObject({
      content: 'installed',
    });
    expect(executeCommand.mock.calls.some(([, args]) => String(args?.[1]).includes('check-ignore'))).toBe(false);
    await expect(listSessionWorkspaceTree(makeSession(), '.git')).rejects.toThrow('not available');
    expect(names(await listSessionWorkspaceTree(makeSession(), 'docs'))).toEqual([
      'd src',
      'f .gitignore',
      'f README.md',
    ]);
    expect((await listSessionWorkspaceTree(makeSession(), 'docs/src')).entries[1]).toEqual({
      name: 'agent.ts',
      path: 'docs/src/agent.ts',
      type: 'file',
      size: 24,
    });
    await expect(readSessionWorkspaceFile(makeSession(), 'docs/README.md')).resolves.toMatchObject({
      content: '# acme/docs',
    });
    await expect(readSessionWorkspaceFile(makeSession(), 'docs/.env')).rejects.toThrow('not available');
    await expect(listSessionWorkspaceTree(makeSession(), 'docs/../..')).rejects.toThrow('escapes');
  });

  it('reports a session with no sandbox in this process as unavailable without starting one', async () => {
    await expect(listSessionWorkspaceTree(makeSession(), 'src')).resolves.toEqual({
      workspacePath: makeSession().sessionId,
      path: 'src',
      available: false,
      entries: [],
    });
  });

  it('fails closed when git cannot say what is ignored', async () => {
    const { executeCommand } = await seedHostCheckouts();
    const host = executeCommand.getMockImplementation()!;
    executeCommand.mockImplementation(async (command, args = [], options) =>
      args[1]?.includes('check-ignore')
        ? { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' }
        : host(command, args, options),
    );

    await expect(listSessionWorkspaceTree(makeSession())).rejects.toThrow('Unable to check ignored files');
    await expect(readSessionWorkspaceFile(makeSession(), 'README.md')).rejects.toThrow('Unable to check ignored files');
  });

  it('serves the tree and file routes after authorizing the caller', async () => {
    await seedHostCheckouts();
    const { deps, ensureUser } = makeSessionFs();
    const tree = await requestSessionRoute('/web/workspace/tree', deps);
    const file = await requestSessionRoute('/web/workspace/file', deps);
    const id = makeSession().sessionId;

    const listing = await tree(`?workspacePath=${id}&path=src`);
    expect(listing.status).toBe(200);
    expect(names(await listing.json())).toEqual(['d nested', 'f agent.ts']);
    expect((await tree(`?workspacePath=${id}&path=node_modules`)).status).toBe(403);
    expect((await tree(`?workspacePath=${id}&path=..`)).status).toBe(403);

    expect((await file(`?workspacePath=${id}&path=src/agent.ts`)).status).toBe(200);
    expect((await file(`?workspacePath=${id}&path=.env`)).status).toBe(403);
    expect(ensureUser).toHaveBeenCalledTimes(5);
  });

  it("refuses another user's session before touching its sandbox", async () => {
    const { executeCommand } = await seedHostCheckouts();
    const { deps } = makeSessionFs();
    deps.auth.tenant = () => ({ orgId: 'org-1', userId: 'someone-else' });
    const tree = await requestSessionRoute('/web/workspace/tree', deps);

    expect((await tree(`?workspacePath=${makeSession().sessionId}`)).status).toBe(403);
    expect(executeCommand).not.toHaveBeenCalled();
  });
});

describe('listSessionRenderedPath', () => {
  it('lists rendered entries from the session sandbox in one command', async () => {
    const { executeCommand } = seedSessionSandbox(script => {
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
    const listing = await listSessionRenderedPath(session, '.artifacts');

    expect(listing.workspacePath).toBe(session.sessionId);
    expect(listing.root).toBe('.artifacts');
    expect(listing.rootPath).toBe(`${WORKDIR}/.artifacts`);
    expect(listing.entries).toEqual([
      expect.objectContaining({ name: 'understand-pr', path: 'understand-pr', type: 'directory', size: 0 }),
      expect.objectContaining({ name: 'HISTORY.md', path: 'understand-pr/HISTORY.md', type: 'file', size: 5 }),
    ]);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand.mock.calls[0]?.[2]?.maxRetainedBytes).toBe(Infinity);
  });

  it('returns an empty listing when this process holds no sandbox for the session', async () => {
    // Never seeded: the passive read path resolves through the memo only —
    // it must not construct or provision anything.
    const listing = await listSessionRenderedPath(makeSession(), '.artifacts');

    expect(listing.entries).toEqual([]);
  });

  it('returns an empty listing when the rendered root does not exist', async () => {
    seedSessionSandbox(() => ({ exitCode: 0, stdout: '' }));

    const listing = await listSessionRenderedPath(makeSession(), '.artifacts');

    expect(listing.entries).toEqual([]);
  });

  it('rejects roots outside the approved allowlist without touching the sandbox', async () => {
    const { executeCommand } = seedSessionSandbox(() => ({ exitCode: 0, stdout: '' }));

    await expect(listSessionRenderedPath(makeSession(), '.ssh')).rejects.toThrow(
      'Root is not approved for rendered workspace access',
    );
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('ignores find output outside the rendered root', async () => {
    seedSessionSandbox(() => ({
      exitCode: 0,
      stdout: `f\t5\t1700000000.0\t/etc/passwd\n`,
    }));

    const listing = await listSessionRenderedPath(makeSession(), '.artifacts');

    expect(listing.entries).toEqual([]);
  });
});

describe('readSessionWorkspaceFile', () => {
  function respondForFile(content: string) {
    const abs = `${WORKDIR}/.artifacts/understand-pr/HISTORY.md`;
    return (script: string) => {
      if (script.includes(`p='${abs}'`)) return { exitCode: 0, stdout: `${WORKDIR}\n${abs}` };
      if (script.startsWith('stat -c')) return { exitCode: 0, stdout: `regular file|${content.length}|1700000000|0\n` };
      if (script.includes('base64 <')) return { exitCode: 0, stdout: Buffer.from(content, 'utf8').toString('base64') };
      return { exitCode: 1, stdout: '', stderr: `unexpected script: ${script}` };
    };
  }

  it('reads text content through the session sandbox', async () => {
    seedSessionSandbox(respondForFile('# History'));

    const session = makeSession();
    const file = await readSessionWorkspaceFile(session, '.artifacts/understand-pr/HISTORY.md');

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

  it('rejects traversal outside the workspace', async () => {
    seedSessionSandbox(respondForFile('secret'));

    await expect(readSessionWorkspaceFile(makeSession(), '../secret.md')).rejects.toThrow('path escapes workspace');
  });

  it('rejects directories', async () => {
    seedSessionSandbox(script => {
      if (script.includes(`p='${WORKDIR}/.artifacts'`)) {
        return { exitCode: 0, stdout: `${WORKDIR}\n${WORKDIR}/.artifacts` };
      }
      if (script.startsWith('stat -c')) return { exitCode: 0, stdout: `directory|0|1700000000|0\n` };
      return { exitCode: 1, stdout: '' };
    });

    await expect(readSessionWorkspaceFile(makeSession(), '.artifacts')).rejects.toThrow('Path is a directory');
  });

  describe('when the sandbox has a native filesystem', () => {
    const abs = `${WORKDIR}/.artifacts/understand-pr/HISTORY.md`;
    function nativeFilesystem(content: string) {
      return {
        stat: vi.fn(async (path: string) => ({
          name: 'HISTORY.md',
          path,
          type: 'file',
          size: content.length,
          createdAt: new Date(0),
          modifiedAt: new Date(1_700_000_000_000),
        })),
        readFile: vi.fn(async () => Buffer.from(content, 'utf8')),
      };
    }

    it('reads through it after one symlink check for the path', async () => {
      const filesystem = nativeFilesystem('# History');
      const { executeCommand } = seedSessionSandbox(
        script =>
          script.includes(`p='${abs}'`) ? { exitCode: 0, stdout: `${WORKDIR}\n${abs}` } : { exitCode: 1, stdout: '' },
        { filesystem },
      );

      const file = await readSessionWorkspaceFile(makeSession(), '.artifacts/understand-pr/HISTORY.md');

      expect(file).toMatchObject({ content: '# History', contentType: 'text' });
      expect(executeCommand).toHaveBeenCalledTimes(1);
      expect(filesystem.stat).toHaveBeenCalledWith(abs);
      expect(filesystem.readFile).toHaveBeenCalledWith(abs, undefined);
    });

    it('refuses a symlink that leads outside the checkout', async () => {
      const filesystem = nativeFilesystem('root:x:0:0');
      seedSessionSandbox(() => ({ exitCode: 0, stdout: `${WORKDIR}\n/etc/passwd` }), { filesystem });

      await expect(readSessionWorkspaceFile(makeSession(), '.artifacts/understand-pr/HISTORY.md')).rejects.toThrow(
        'Path escapes workspace root (symlink)',
      );
      expect(filesystem.stat).not.toHaveBeenCalled();
      expect(filesystem.readFile).not.toHaveBeenCalled();
    });
  });

  it('errors without provisioning when this process holds no sandbox for the session', async () => {
    // Never seeded: reads must fail cleanly rather than construct a sandbox.
    await expect(readSessionWorkspaceFile(makeSession(), '.artifacts/a.md')).rejects.toThrow(
      'Session workspace is not available',
    );
  });
});

describe('workspace changes', () => {
  it('parses modified, untracked, deleted, and renamed files from null-delimited status output', () => {
    const output = [
      ' M src/edited.ts',
      '?? src/new.ts',
      'D  src/removed.ts',
      'R  src/renamed.ts',
      'src/old.ts',
      '',
    ].join('\0');

    expect(parseWorkspaceChanges(output)).toEqual([
      { path: 'src/edited.ts', status: 'modified' },
      { path: 'src/new.ts', status: 'untracked' },
      { path: 'src/removed.ts', status: 'deleted' },
      { path: 'src/renamed.ts', previousPath: 'src/old.ts', status: 'renamed' },
    ]);
  });

  it('parses committed add, delete, and rename records from null-delimited name-status output', () => {
    expect(parseWorkspaceTrackedChanges('A\0src/added.ts\0D\0src/deleted.ts\0R100\0src/old.ts\0src/new.ts\0')).toEqual([
      { path: 'src/added.ts', status: 'added' },
      { path: 'src/deleted.ts', status: 'deleted' },
      { path: 'src/new.ts', previousPath: 'src/old.ts', status: 'renamed' },
    ]);
  });

  it('parses text, binary, and renamed file counts from null-delimited numstat output', () => {
    const output = ['12\t3\tsrc/edited.ts', '-\t-\tpublic/image.png', '4\t2\t', 'src/old.ts', 'src/new.ts', ''].join(
      '\0',
    );

    expect([...parseWorkspaceChangeStats(output)]).toEqual([
      ['src/edited.ts', { additions: 12, deletions: 3 }],
      ['public/image.png', { binary: true }],
      ['src/new.ts', { additions: 4, deletions: 2 }],
    ]);
  });

  it('lists pending changes with per-file and total line counts', async () => {
    const { executeCommand } = seedSessionSandbox((script, command, args) => {
      if (command === 'git') {
        expect(args).toEqual(['-C', WORKDIR, 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
        return { exitCode: 0, stdout: ' M src/edited.ts\0?? src/new.ts\0' };
      }

      expect(command).toBe('sh');
      expect(script).toContain('diff --numstat -z --find-renames');
      expect(script).toContain('ls-files --others --exclude-standard -z');
      expect(script).toContain('GIT_OBJECT_DIRECTORY="$object_dir"');
      expect(args.slice(2)).toEqual(['mastracode-numstat', WORKDIR, BASE_SHA]);
      return { exitCode: 0, stdout: '3\t1\tsrc/edited.ts\0' + '5\t0\t\0/dev/null\0src/new.ts\0' };
    });

    const session = makeSession();
    await expect(listSessionWorkspaceChanges(session)).resolves.toEqual({
      workspacePath: session.sessionId,
      available: true,
      additions: 8,
      deletions: 1,
      changes: [
        { path: 'src/edited.ts', status: 'modified', additions: 3, deletions: 1 },
        { path: 'src/new.ts', status: 'untracked', additions: 5, deletions: 0 },
      ],
    });
    expect(executeCommand).toHaveBeenCalledTimes(4);
    // Parsed outputs must not be cut to the default 1 MiB tail; merge-base is a single SHA.
    for (const [command, args, options] of executeCommand.mock.calls) {
      if (command === 'git' && args?.[2] === 'merge-base') continue;
      expect(options?.maxRetainedBytes).toBe(Infinity);
    }
  });

  it('keeps committed session-branch changes visible after the worktree is clean', async () => {
    const { executeCommand } = seedSessionSandbox(
      (_script, command) =>
        command === 'git' ? { exitCode: 0, stdout: '' } : { exitCode: 0, stdout: '7\t2\tsrc/committed.ts\0' },
      { trackedChanges: 'M\0src/committed.ts\0' },
    );

    const session = makeSession({ branch: 'factory/issue-42', baseBranch: 'main' });
    await expect(listSessionWorkspaceChanges(session)).resolves.toEqual({
      workspacePath: session.sessionId,
      available: true,
      additions: 7,
      deletions: 2,
      changes: [{ path: 'src/committed.ts', status: 'modified', additions: 7, deletions: 2 }],
    });
    expect(executeCommand).toHaveBeenCalledWith('git', ['-C', WORKDIR, 'merge-base', 'HEAD', 'origin/main'], {
      timeout: 30_000,
    });
  });

  it('keeps file statuses available when line counting fails', async () => {
    seedSessionSandbox((_script, command) =>
      command === 'git'
        ? { exitCode: 0, stdout: ' M src/edited.ts\0' }
        : { exitCode: 1, stdout: '', stderr: 'numstat failed' },
    );

    const session = makeSession();
    await expect(listSessionWorkspaceChanges(session)).resolves.toEqual({
      workspacePath: session.sessionId,
      available: true,
      changes: [{ path: 'src/edited.ts', status: 'modified' }],
    });
  });

  it('returns a bounded unified diff for one selected file', async () => {
    const patch = [
      'diff --git a/src/edited.ts b/src/edited.ts',
      '--- a/src/edited.ts',
      '+++ b/src/edited.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '',
    ].join('\n');
    const { executeCommand } = seedSessionSandbox((script, command, args) => {
      expect(command).toBe('sh');
      expect(script).toContain('head -c 524289');
      expect(args.slice(3)).toEqual([
        '0',
        '--literal-pathspecs',
        '-C',
        WORKDIR,
        'diff',
        '--find-renames',
        '--no-ext-diff',
        '--no-color',
        '--unified=3',
        BASE_SHA,
        '--',
        'src/edited.ts',
      ]);
      return { exitCode: 0, stdout: patch };
    });

    const session = makeSession();
    await expect(readSessionWorkspaceDiff(session, 'src/edited.ts')).resolves.toEqual({
      workspacePath: session.sessionId,
      path: 'src/edited.ts',
      patch,
      truncated: false,
    });
    expect(executeCommand).toHaveBeenCalledTimes(2);
  });

  it('marks and limits a diff that exceeds the output boundary', async () => {
    const maxDiffBytes = 512 * 1024;
    seedSessionSandbox(() => ({ exitCode: 0, stdout: 'a'.repeat(maxDiffBytes + 1) }));

    const result = await readSessionWorkspaceDiff(makeSession(), 'src/large.ts');

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.patch)).toBe(maxDiffBytes);
  });

  it('does not emit a replacement character when truncation splits UTF-8', async () => {
    const maxDiffBytes = 512 * 1024;
    const prefix = 'a'.repeat(maxDiffBytes - 1);
    seedSessionSandbox(() => ({ exitCode: 0, stdout: `${prefix}€` }));

    const result = await readSessionWorkspaceDiff(makeSession(), 'src/unicode.ts');

    expect(result.truncated).toBe(true);
    expect(result.patch).toBe(prefix);
    expect(result.patch).not.toContain('\uFFFD');
  });

  it('includes both paths when reading a renamed file diff', async () => {
    seedSessionSandbox((_script, command, args) => {
      expect(command).toBe('sh');
      expect(args.slice(3)).toEqual([
        '0',
        '--literal-pathspecs',
        '-C',
        WORKDIR,
        'diff',
        '--find-renames',
        '--no-ext-diff',
        '--no-color',
        '--unified=3',
        BASE_SHA,
        '--',
        'src/old.ts',
        'src/renamed.ts',
      ]);
      return { exitCode: 0, stdout: 'rename diff' };
    });

    await expect(readSessionWorkspaceDiff(makeSession(), 'src/renamed.ts', 'src/old.ts')).resolves.toEqual(
      expect.objectContaining({ path: 'src/renamed.ts', patch: 'rename diff' }),
    );
  });

  it('treats pathspec magic in file names literally', async () => {
    const path = 'src/:(exclude)*.ts';
    seedSessionSandbox((_script, command, args) => {
      expect(command).toBe('sh');
      expect(args.slice(3)).toEqual([
        '0',
        '--literal-pathspecs',
        '-C',
        WORKDIR,
        'diff',
        '--find-renames',
        '--no-ext-diff',
        '--no-color',
        '--unified=3',
        BASE_SHA,
        '--',
        path,
      ]);
      return { exitCode: 0, stdout: 'literal path diff' };
    });

    await expect(readSessionWorkspaceDiff(makeSession(), path)).resolves.toEqual(
      expect.objectContaining({ path, patch: 'literal path diff' }),
    );
  });

  it('creates a bounded diff for an untracked file', async () => {
    let commandIndex = 0;
    const { executeCommand } = seedSessionSandbox((script, command, args) => {
      commandIndex += 1;
      if (commandIndex === 1) {
        expect(command).toBe('sh');
        return { exitCode: 0, stdout: '' };
      }
      if (commandIndex === 2) {
        expect(command).toBe('git');
        expect(args).toEqual([
          '--literal-pathspecs',
          '-C',
          WORKDIR,
          'ls-files',
          '--others',
          '--exclude-standard',
          '--',
          'src/new.ts',
        ]);
        return { exitCode: 0, stdout: 'src/new.ts\n' };
      }
      expect(command).toBe('sh');
      expect(script).toContain('head -c 524289');
      expect(args.slice(3)).toEqual([
        '1',
        '-C',
        WORKDIR,
        'diff',
        '--no-index',
        '--no-ext-diff',
        '--no-color',
        '--unified=3',
        '--',
        '/dev/null',
        'src/new.ts',
      ]);
      return { exitCode: 0, stdout: 'new file diff' };
    });

    await expect(readSessionWorkspaceDiff(makeSession(), 'src/new.ts')).resolves.toEqual(
      expect.objectContaining({ path: 'src/new.ts', patch: 'new file diff' }),
    );
    expect(executeCommand).toHaveBeenCalledTimes(4);
    const lsFiles = executeCommand.mock.calls.find(([, args]) => args?.includes('ls-files'));
    expect(lsFiles?.[2]?.maxRetainedBytes).toBe(Infinity);
  });

  it('rejects diff paths that escape the workspace before running git', async () => {
    const { executeCommand } = seedSessionSandbox(() => ({ exitCode: 0, stdout: '' }));

    await expect(readSessionWorkspaceDiff(makeSession(), '../secret')).rejects.toThrow('path escapes workspace');
    expect(executeCommand).not.toHaveBeenCalled();
  });
});

describe('workspace changes across environment repositories', () => {
  const ROOT = '/workspaces/acme';
  const DIRS = { 'acme/repo': `${ROOT}/repo`, 'acme/docs': `${ROOT}/docs`, 'acme/site': `${ROOT}/site` };
  type Answer = { exitCode: number; stdout: string; stderr?: string };

  /**
   * Seed a three-repository layout (own repository `acme/repo`, base `main`;
   * `acme/docs` and `acme/site` on their default branch `develop`) whose fake
   * sandbox answers each git call by the checkout it names.
   */
  function seedEnvironment(
    answer: (
      dir: string,
      kind: 'merge-base' | 'status' | 'tracked' | 'numstat' | 'diff' | 'other',
      args: string[],
    ) => Answer,
    { recorded = ['acme/repo', 'acme/docs', 'acme/site'] }: { recorded?: string[] } = {},
  ) {
    const executeCommand = vi.fn(async (command: string, args: string[] = []) => {
      const script = args[1] ?? '';
      const dirIndex = args.indexOf('-C');
      const dir = dirIndex >= 0 ? args[dirIndex + 1]! : (args[3] ?? '');
      const kind =
        command === 'git' && args[2] === 'merge-base'
          ? 'merge-base'
          : command === 'git' && args[2] === 'status'
            ? 'status'
            : command === 'git' && args[2] === 'diff'
              ? 'tracked'
              : script.includes('diff --numstat')
                ? 'numstat'
                : script.includes('head -c')
                  ? 'diff'
                  : 'other';
      const result = answer(dir, kind, args);
      return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr ?? '' };
    });
    getSessionSandbox(
      'row-1',
      'acme/repo',
      () => ({ id: 'sbx-1', provider: 'local', workingDirectory: ROOT, executeCommand }) as never,
      ['acme/repo', 'acme/docs', 'acme/site'],
    );
    const session = makeSession({ baseBranch: 'main' });
    recordSessionEnvironment(session.sessionId, {
      workingDirectory: ROOT,
      repositories: recorded.map((slug, index) => ({
        slug,
        dir: DIRS[slug as keyof typeof DIRS],
        branch: slug === 'acme/repo' ? 'factory/issue-1' : 'develop',
        defaultBranch: 'develop',
        position: index + 1,
        setupStatus: 'ok' as const,
      })),
    });
    return { executeCommand, session };
  }

  afterEach(() => {
    __clearSessionEnvironmentsForTests();
  });

  it('groups changes per repository with prefixed paths and sums the totals over the groups', async () => {
    const { executeCommand, session } = seedEnvironment((dir, kind) => {
      if (kind === 'merge-base') return { exitCode: 0, stdout: `${BASE_SHA}\n` };
      if (kind === 'status') {
        if (dir === DIRS['acme/repo']) return { exitCode: 0, stdout: ' M src/edited.ts\0' };
        if (dir === DIRS['acme/docs']) return { exitCode: 0, stdout: '?? guide.md\0' };
        return { exitCode: 0, stdout: '' };
      }
      if (kind === 'tracked') return { exitCode: 1, stdout: '', stderr: 'not configured' };
      if (kind === 'numstat') {
        if (dir === DIRS['acme/repo']) return { exitCode: 0, stdout: '3\t1\tsrc/edited.ts\0' };
        if (dir === DIRS['acme/docs']) return { exitCode: 0, stdout: '5\t0\t\0/dev/null\0guide.md\0' };
        return { exitCode: 0, stdout: '' };
      }
      return { exitCode: 1, stdout: '', stderr: `unexpected ${kind}` };
    });

    await expect(listSessionWorkspaceChanges(session)).resolves.toEqual({
      workspacePath: session.sessionId,
      available: true,
      additions: 8,
      deletions: 1,
      changes: [
        { path: 'docs/guide.md', status: 'untracked', additions: 5, deletions: 0 },
        { path: 'repo/src/edited.ts', status: 'modified', additions: 3, deletions: 1 },
      ],
      repositories: [
        {
          slug: 'acme/repo',
          prefix: 'repo/',
          available: true,
          additions: 3,
          deletions: 1,
          changes: [{ path: 'repo/src/edited.ts', status: 'modified', additions: 3, deletions: 1 }],
        },
        {
          slug: 'acme/docs',
          prefix: 'docs/',
          available: true,
          additions: 5,
          deletions: 0,
          changes: [{ path: 'docs/guide.md', status: 'untracked', additions: 5, deletions: 0 }],
        },
        { slug: 'acme/site', prefix: 'site/', available: true, additions: 0, deletions: 0, changes: [] },
      ],
    });
    // The own repository compares against the session base branch, the others against their default branch.
    const mergeBases = executeCommand.mock.calls.filter(call => call[1]?.[2] === 'merge-base').map(call => call[1]);
    expect(mergeBases).toEqual([
      ['-C', DIRS['acme/repo'], 'merge-base', 'HEAD', 'origin/main'],
      ['-C', DIRS['acme/docs'], 'merge-base', 'HEAD', 'origin/develop'],
      ['-C', DIRS['acme/site'], 'merge-base', 'HEAD', 'origin/develop'],
    ]);
    // Four git calls per checkout: merge-base, status, name-status, numstat.
    expect(executeCommand).toHaveBeenCalledTimes(12);
  });

  it('marks a repository whose status fails unavailable, and compares an unrecorded one against its HEAD', async () => {
    const { executeCommand, session } = seedEnvironment(
      (dir, kind) => {
        if (kind === 'merge-base') return { exitCode: 0, stdout: `${BASE_SHA}\n` };
        if (kind === 'status') {
          if (dir === DIRS['acme/docs']) return { exitCode: 128, stdout: '', stderr: 'fatal: not a git repository' };
          return { exitCode: 0, stdout: dir === DIRS['acme/site'] ? ' M s.ts\0' : ' M a.ts\0' };
        }
        if (kind === 'tracked') return { exitCode: 1, stdout: '' };
        if (kind === 'numstat') {
          return { exitCode: 0, stdout: dir === DIRS['acme/site'] ? '2\t0\ts.ts\0' : '1\t0\ta.ts\0' };
        }
        return { exitCode: 1, stdout: '' };
      },
      { recorded: ['acme/repo', 'acme/docs'] },
    );

    await expect(listSessionWorkspaceChanges(session)).resolves.toEqual({
      workspacePath: session.sessionId,
      available: true,
      additions: 3,
      deletions: 0,
      changes: [
        { path: 'repo/a.ts', status: 'modified', additions: 1, deletions: 0 },
        { path: 'site/s.ts', status: 'modified', additions: 2, deletions: 0 },
      ],
      repositories: [
        {
          slug: 'acme/repo',
          prefix: 'repo/',
          available: true,
          additions: 1,
          deletions: 0,
          changes: [{ path: 'repo/a.ts', status: 'modified', additions: 1, deletions: 0 }],
        },
        { slug: 'acme/docs', prefix: 'docs/', available: false, changes: [] },
        {
          slug: 'acme/site',
          prefix: 'site/',
          available: true,
          additions: 2,
          deletions: 0,
          changes: [{ path: 'site/s.ts', status: 'modified', additions: 2, deletions: 0 }],
        },
      ],
    });
    // The boot has not recorded `acme/site` yet: it compares against its own HEAD.
    expect(executeCommand).toHaveBeenCalledWith('git', ['-C', DIRS['acme/site'], 'merge-base', 'HEAD', 'origin/HEAD'], {
      timeout: 30_000,
    });
  });

  it('is unavailable as a whole, still listing the groups, when every checkout fails', async () => {
    const { session } = seedEnvironment((_dir, kind) =>
      kind === 'merge-base' ? { exitCode: 0, stdout: `${BASE_SHA}\n` } : { exitCode: 128, stdout: '' },
    );

    await expect(listSessionWorkspaceChanges(session)).resolves.toEqual({
      workspacePath: session.sessionId,
      available: false,
      changes: [],
      repositories: [
        { slug: 'acme/repo', prefix: 'repo/', available: false, changes: [] },
        { slug: 'acme/docs', prefix: 'docs/', available: false, changes: [] },
        { slug: 'acme/site', prefix: 'site/', available: false, changes: [] },
      ],
    });
  });

  it('runs the diff of a prefixed path inside its checkout and echoes the prefixed path', async () => {
    const patch = 'diff --git a/guide.md b/guide.md\n+hello\n';
    const { executeCommand, session } = seedEnvironment((dir, kind, args) => {
      if (kind === 'merge-base') {
        expect(args).toEqual(['-C', DIRS['acme/docs'], 'merge-base', 'HEAD', 'origin/develop']);
        return { exitCode: 0, stdout: `${BASE_SHA}\n` };
      }
      if (kind === 'diff') {
        expect(dir).toBe(DIRS['acme/docs']);
        expect(args.slice(-3)).toEqual([BASE_SHA, '--', 'guide.md']);
        return { exitCode: 0, stdout: patch };
      }
      return { exitCode: 1, stdout: '', stderr: `unexpected ${kind}` };
    });

    await expect(readSessionWorkspaceDiff(session, 'docs/guide.md')).resolves.toEqual({
      workspacePath: session.sessionId,
      path: 'docs/guide.md',
      patch,
      truncated: false,
    });
    expect(executeCommand).toHaveBeenCalledTimes(2);
  });

  it('passes both halves of a rename relative to their checkout', async () => {
    const { session } = seedEnvironment((_dir, kind, args) => {
      if (kind === 'merge-base') return { exitCode: 0, stdout: `${BASE_SHA}\n` };
      if (kind === 'diff') {
        expect(args.slice(-4)).toEqual([BASE_SHA, '--', 'old.md', 'new.md']);
        return { exitCode: 0, stdout: 'renamed' };
      }
      return { exitCode: 1, stdout: '' };
    });

    await expect(readSessionWorkspaceDiff(session, 'docs/new.md', 'docs/old.md')).resolves.toMatchObject({
      path: 'docs/new.md',
      patch: 'renamed',
    });
  });

  it('rejects a rename whose previous path lives in another repository before running git', async () => {
    const { executeCommand, session } = seedEnvironment(() => ({ exitCode: 0, stdout: '' }));

    await expect(readSessionWorkspaceDiff(session, 'docs/new.md', 'repo/old.md')).rejects.toThrow(
      'previousPath is not available',
    );
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('rejects a bare repository prefix, an unknown prefix and a traversal through a prefix before running git', async () => {
    const { executeCommand, session } = seedEnvironment(() => ({ exitCode: 0, stdout: '' }));

    await expect(readSessionWorkspaceDiff(session, 'docs')).rejects.toThrow('path is not available');
    await expect(readSessionWorkspaceDiff(session, 'docs/')).rejects.toThrow('path is not available');
    await expect(readSessionWorkspaceDiff(session, '.workspace-setup-ran')).rejects.toThrow('path is not available');
    await expect(readSessionWorkspaceDiff(session, 'docs/../repo/x')).rejects.toThrow('path escapes workspace');
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('reads a root artifact and a prefixed file on the workspace root filesystem', async () => {
    const files: Record<string, string> = {
      [`${ROOT}/.artifacts/report.md`]: '# Report',
      [`${ROOT}/docs/guide.md`]: '# Guide',
    };
    const { session } = seedEnvironment((_dir, _kind, args) => {
      const script = args[1] ?? '';
      const match = /p='([^']+)'/.exec(script);
      const abs = match?.[1];
      if (abs && files[abs] !== undefined && script.includes('readlink'))
        return { exitCode: 0, stdout: `${ROOT}\n${abs}` };
      if (script.startsWith('stat -c')) return { exitCode: 0, stdout: 'regular file|8|1700000000|0\n' };
      const read = /base64 < '([^']+)'/.exec(script);
      if (read && files[read[1]!] !== undefined) {
        return { exitCode: 0, stdout: Buffer.from(files[read[1]!]!, 'utf8').toString('base64') };
      }
      return { exitCode: 1, stdout: '', stderr: `unexpected script: ${script}` };
    });

    await expect(readSessionWorkspaceFile(session, '.artifacts/report.md')).resolves.toMatchObject({
      path: '.artifacts/report.md',
      content: '# Report',
    });
    await expect(readSessionWorkspaceFile(session, 'docs/guide.md')).resolves.toMatchObject({
      path: 'docs/guide.md',
      content: '# Guide',
    });
  });
});
