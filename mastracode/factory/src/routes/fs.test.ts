import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
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
  listSessionWorkspacePatches,
  listWorkspaceRenderedPath,
  parseWorkspaceChanges,
  parseWorkspaceChangeStats,
  parseWorkspaceTrackedChanges,
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
/**
 * Answers the tree's checks for a mocked sandbox with no symlinks and nothing
 * ignored: `realpath` maps each path under the root, `check-ignore` matches none.
 */
function treeCheck(args: string[]): { exitCode: number; stdout: string } | undefined {
  const [, script = '', , root = '', ...paths] = args;
  if (!script.startsWith('cd "$1" && shift')) return undefined;
  if (script.includes('readlink -f')) {
    return { exitCode: 0, stdout: [root, ...paths.map(path => `${root}/${path}`)].map(p => `${p}\0`).join('') };
  }
  if (script.includes('git check-ignore -z --stdin')) return { exitCode: 1, stdout: '' };
  return undefined;
}

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

  it('sends only the shown part of a large file out of the sandbox', async () => {
    const { parent } = await seedHostCheckouts();
    const shown = 512 * 1024;
    await writeFile(join(parent, 'repo', 'big.log.txt'), 'a'.repeat(shown) + 'b'.repeat(10));
    await writeFile(join(parent, 'repo', 'big.bin'), Buffer.concat([Buffer.alloc(shown, 0xff), Buffer.from('x')]));
    const readFile = vi.spyOn(LocalFilesystem.prototype, 'readFile');

    const big = await readSessionWorkspaceFile(makeSession(), 'big.log.txt');
    expect(big).toMatchObject({ contentType: 'text', truncated: true, size: shown + 10 });
    expect(big.contentType === 'text' && big.content).toBe('a'.repeat(shown));
    await expect(readSessionWorkspaceFile(makeSession(), 'big.bin')).resolves.toMatchObject({
      contentType: 'unsupported',
      size: shown + 1,
    });
    expect(readFile).not.toHaveBeenCalled();
    readFile.mockRestore();
  });

  // Root ignores file permissions, so the unreadable file can't be produced (CI runs as root).
  const runningAsRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  it.skipIf(runningAsRoot)('reports a large file it cannot read instead of showing it empty', async () => {
    const { parent } = await seedHostCheckouts();
    const path = join(parent, 'repo', 'locked.log.txt');
    await writeFile(path, 'a'.repeat(512 * 1024 + 1));
    await chmod(path, 0o000);

    await expect(readSessionWorkspaceFile(makeSession(), 'locked.log.txt')).rejects.toThrow('Unable to read file');
  });

  it('keeps leading and trailing spaces in listed names', async () => {
    const { parent } = await seedHostCheckouts();
    await mkdir(join(parent, 'repo', ' spaced '));
    await writeFile(join(parent, 'repo', ' spaced ', ' note.md '), 'spaced');

    const listing = await listSessionWorkspaceTree(makeSession(), ' spaced ');
    expect(listing.entries).toEqual([{ name: ' note.md ', path: ' spaced / note.md ', type: 'file', size: 6 }]);
    await expect(readSessionWorkspaceFile(makeSession(), ' spaced / note.md ')).resolves.toMatchObject({
      content: 'spaced',
    });
  });

  it('refuses a file whose symlink leads outside the checkout', async () => {
    const { parent } = await seedHostCheckouts();
    const outside = await mkdtemp(join(tmpdir(), 'factory-tree-outside-'));
    await writeFile(join(outside, 'secret.txt'), 'secret');
    await symlink(join(outside, 'secret.txt'), join(parent, 'repo', 'src', 'link.txt'));

    await expect(readSessionWorkspaceFile(makeSession(), 'src/link.txt')).rejects.toThrow('not available');
    expect((await listSessionWorkspaceTree(makeSession(), 'src')).entries.map(entry => entry.name)).not.toContain(
      'link.txt',
    );
  });

  it('serves files whose names start with two dots, directly and through a symlink', async () => {
    const { parent } = await seedHostCheckouts();
    const repo = join(parent, 'repo');
    await writeFile(join(repo, '..notes.md'), 'dots');
    await symlink('../..notes.md', join(repo, 'src', 'notes-link.md'));

    expect(names(await listSessionWorkspaceTree(makeSession(), ''))).toContain('f ..notes.md');
    expect(names(await listSessionWorkspaceTree(makeSession(), 'src'))).toContain('f notes-link.md');
    await expect(readSessionWorkspaceFile(makeSession(), '..notes.md')).resolves.toMatchObject({ content: 'dots' });
    await expect(readSessionWorkspaceFile(makeSession(), 'src/notes-link.md')).resolves.toMatchObject({
      content: 'dots',
    });
  });

  it('hides and refuses symlinks that lead to ignored files inside the checkout', async () => {
    const { parent } = await seedHostCheckouts();
    const repo = join(parent, 'repo');
    await symlink('../.env', join(repo, 'src', 'env-link.txt'));
    await symlink('../node_modules', join(repo, 'src', 'deps'));
    await symlink('../README.md', join(repo, 'src', 'readme-link.md'));
    await symlink('missing.ts', join(repo, 'src', 'broken.ts'));

    expect(names(await listSessionWorkspaceTree(makeSession(), 'src'))).toEqual([
      'd nested',
      'f agent.ts',
      'f readme-link.md',
    ]);
    expect((await listSessionWorkspaceTree(makeSession(), 'src')).entries).toContainEqual(
      expect.objectContaining({ name: 'readme-link.md', symlinkTarget: '../README.md', linkedPath: 'README.md' }),
    );
    await symlink('nested', join(repo, 'src', 'nested-link'));
    await expect(listSessionWorkspaceTree(makeSession(), 'src/nested-link')).rejects.toThrow('not available');
    await expect(readSessionWorkspaceFile(makeSession(), 'src/nested-link/deep.ts')).rejects.toThrow('not available');
    await expect(readSessionWorkspaceFile(makeSession(), 'src/env-link.txt')).rejects.toThrow('not available');
    await expect(readSessionWorkspaceFile(makeSession(), 'src/deps/pkg/index.js')).rejects.toThrow('not available');
    await expect(listSessionWorkspaceTree(makeSession(), 'src/deps')).rejects.toThrow('not available');
    await expect(readSessionWorkspaceFile(makeSession(), 'src/readme-link.md')).resolves.toMatchObject({
      content: '# acme/repo',
    });
  });

  it('refuses ignored files reached from outside a checkout or through a rendered root', async () => {
    const { parent } = await seedHostCheckouts(['acme/repo', 'acme/docs']);
    await mkdir(join(parent, 'notes'));
    await symlink('../repo/.env', join(parent, 'notes', 'env'));
    await mkdir(join(parent, '.artifacts'));
    await symlink('../docs/.env', join(parent, '.artifacts', 'env.md'));

    expect((await listSessionWorkspaceTree(makeSession(), 'notes')).entries).toEqual([]);
    await expect(readSessionWorkspaceFile(makeSession(), 'notes/env')).rejects.toThrow('not available');
    await expect(readSessionWorkspaceFile(makeSession(), '.artifacts/env.md')).rejects.toThrow('not available');
  });

  it('lists the whole working directory of a multi-repository session, then each checkout', async () => {
    const { parent, executeCommand } = await seedHostCheckouts(['acme/repo', 'acme/docs']);
    await mkdir(join(parent, 'notes'));
    await writeFile(join(parent, 'notes', 'setup.log'), 'installed');
    await mkdir(join(parent, '.git'));
    await mkdir(join(parent, '.mastra-sandbox'));
    await writeFile(join(parent, '.mastra-sandbox', 'setup'), 'done');

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
    await expect(listSessionWorkspaceTree(makeSession(), '.git')).rejects.toThrow('not available');
    await expect(listSessionWorkspaceTree(makeSession(), '.mastra-sandbox')).rejects.toThrow('not available');
    await expect(readSessionWorkspaceFile(makeSession(), '.mastra-sandbox/setup')).rejects.toThrow('not available');
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
    return (script: string, _command: string, args: string[]) => {
      const check = treeCheck(args);
      if (check) return check;
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
    seedSessionSandbox((script, _command, args) => {
      const check = treeCheck(args);
      if (check) return check;
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

    it('reads through it after resolving the path and one symlink check', async () => {
      const filesystem = nativeFilesystem('# History');
      const { executeCommand } = seedSessionSandbox(
        (script, _command, args) =>
          treeCheck(args) ??
          (script.includes(`p='${abs}'`) ? { exitCode: 0, stdout: `${WORKDIR}\n${abs}` } : { exitCode: 1, stdout: '' }),
        { filesystem },
      );

      const file = await readSessionWorkspaceFile(makeSession(), '.artifacts/understand-pr/HISTORY.md');

      expect(file).toMatchObject({ content: '# History', contentType: 'text' });
      expect(executeCommand).toHaveBeenCalledTimes(2);
      expect(filesystem.stat).toHaveBeenCalledWith(abs);
      expect(filesystem.readFile).toHaveBeenCalledWith(abs, undefined);
    });

    it('refuses a symlink that leads outside the checkout', async () => {
      const filesystem = nativeFilesystem('root:x:0:0');
      seedSessionSandbox(
        (_script, _command, args) => treeCheck(args) ?? { exitCode: 0, stdout: `${WORKDIR}\n/etc/passwd` },
        { filesystem },
      );

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
    const { executeCommand } = seedSessionSandbox((_script, command, args) => {
      if (command === 'git') {
        expect(args).toEqual(['-C', WORKDIR, 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
        return { exitCode: 0, stdout: ' M src/edited.ts\0?? src/new.ts\0' };
      }

      expect(command).toBe('sh');
      expect(args.slice(2)).toEqual(['mastracode-numstat', WORKDIR, BASE_SHA, '--numstat', '-z']);
      // oxlint-disable-next-line no-useless-concat -- Keep NUL-delimited records separate from the next record's leading digit.
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
});

describe('workspace patches', () => {
  const COMMIT_IDENTITY = [
    '-c',
    'user.name=Factory',
    '-c',
    'user.email=factory@example.com',
    '-c',
    'commit.gpgsign=false',
  ];

  /**
   * Real checkouts behind a sandbox whose commands run on the host, each with
   * its base branch `main` pushed to `origin/main`.
   */
  async function seedRepositories(slugs: string[] = ['acme/repo']) {
    const parent = await realpath(await mkdtemp(join(tmpdir(), 'factory-patches-')));
    const dirs = slugs.map(slug => join(parent, slug.split('/')[1]!));
    for (const dir of dirs) await execFileAsync('git', ['init', '-q', '-b', 'main', dir]);
    const executeCommand = vi.fn(async (command: string, args: string[] = []) => {
      try {
        const { stdout, stderr } = await execFileAsync(command, args, { cwd: parent, maxBuffer: 64 * 1024 * 1024 });
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
    getSessionSandbox(
      'row-1',
      slugs[0]!,
      () => ({ id: 'sbx-1', provider: 'local', workingDirectory: parent, executeCommand }) as never,
      slugs.length > 1 ? slugs : undefined,
    );
    return dirs;
  }

  async function commitAll(dir: string, message: string) {
    await execFileAsync('git', ['-C', dir, 'add', '-A']);
    await execFileAsync('git', ['-C', dir, ...COMMIT_IDENTITY, 'commit', '-q', '--no-verify', '-m', message]);
  }

  async function publishBase(dir: string) {
    await execFileAsync('git', ['-C', dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD']);
  }

  /** A session branch with one commit on top of `origin/main`, then uncommitted work of every kind. */
  async function seedSessionWork() {
    const [dir] = await seedRepositories();
    await writeFile(join(dir!, 'keep.txt'), 'a\nb\nc\n');
    await writeFile(join(dir!, 'old name.txt'), 'same\n');
    await writeFile(join(dir!, 'gone.txt'), 'bye\n');
    await writeFile(join(dir!, 'logo.png'), Buffer.from([0, 1, 2, 3]));
    await commitAll(dir!, 'base');
    await publishBase(dir!);

    await writeFile(join(dir!, 'keep.txt'), 'a\nB\nc\n');
    await commitAll(dir!, 'session commit');

    await execFileAsync('git', ['-C', dir!, 'mv', 'old name.txt', 'new näme.txt']);
    await execFileAsync('git', ['-C', dir!, 'rm', '-q', 'gone.txt']);
    await writeFile(join(dir!, 'logo.png'), Buffer.from([0, 1, 2, 4]));
    await writeFile(join(dir!, 'say "hi".md'), 'hello\n');
    await writeFile(join(dir!, 'tab\tname.txt'), 'tabbed\n');
  }

  it('gives every change of the session branch its own diff, committed or not', async () => {
    await seedSessionWork();

    const result = await listSessionWorkspacePatches(makeSession(), 'branch');

    expect(result.changes.map(change => [change.path, change.status])).toEqual([
      ['gone.txt', 'deleted'],
      ['keep.txt', 'modified'],
      ['logo.png', 'modified'],
      ['new näme.txt', 'renamed'],
      ['say "hi".md', 'untracked'],
      ['tab\tname.txt', 'untracked'],
    ]);
    expect(new Set(Object.keys(result.patches))).toEqual(new Set(result.changes.map(change => change.path)));
    for (const patch of Object.values(result.patches)) expect(patch.match(/^diff --git /gm)).toHaveLength(1);
    expect(result.patches['gone.txt']).toContain('-bye\n');
    expect(result.patches['keep.txt']).toContain('-b\n+B\n');
    expect(result.patches['logo.png']).toContain('Binary files');
    expect(result.patches['new näme.txt']).toContain('rename from old name.txt');
    expect(result.patches['say "hi".md']).toContain('+hello\n');
    expect(result.patches['tab\tname.txt']).toContain('+tabbed\n');
  });

  it('leaves committed work out of the uncommitted scope', async () => {
    await seedSessionWork();

    const result = await listSessionWorkspacePatches(makeSession(), 'uncommitted');

    expect(result.scope).toBe('uncommitted');
    expect(result.changes.map(change => change.path)).toEqual([
      'gone.txt',
      'logo.png',
      'new näme.txt',
      'say "hi".md',
      'tab\tname.txt',
    ]);
    expect(new Set(Object.keys(result.patches))).toEqual(new Set(result.changes.map(change => change.path)));
  });

  it('lists a change without a diff when its diff passes 512 KB or no longer fits in 8 MB, never cutting one', async () => {
    const [dir] = await seedRepositories();
    await writeFile(join(dir!, 'small.txt'), 'one\n');
    await commitAll(dir!, 'base');
    await publishBase(dir!);

    const line = `${'x'.repeat(99)}\n`;
    const bulkLines = 4096;
    const bulkFiles = Array.from({ length: 22 }, (_, index) => `bulk-${String(index).padStart(2, '0')}.txt`);
    await writeFile(join(dir!, 'small.txt'), 'two\n');
    await writeFile(join(dir!, 'big.txt'), line.repeat(6000));
    for (const file of bulkFiles) await writeFile(join(dir!, file), line.repeat(bulkLines));

    const result = await listSessionWorkspacePatches(makeSession(), 'branch');

    expect(result.changes).toHaveLength(24);
    expect(result.patches['small.txt']).toContain('-one\n+two\n');
    expect(result.patches['big.txt']).toBeUndefined();
    expect(result.omittedPatches['big.txt']).toBe('file-too-large');
    const shown = bulkFiles.filter(file => result.patches[file] !== undefined);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(bulkFiles.length);
    expect(shown).toEqual(bulkFiles.slice(0, shown.length));
    for (const file of shown) {
      const added = result.patches[file]!.split('\n').filter(patchLine => /^\+x/.test(patchLine));
      expect(added).toHaveLength(bulkLines);
    }
    const skipped = bulkFiles.slice(shown.length);
    expect(skipped.map(file => result.omittedPatches[file])).toEqual(skipped.map(() => 'total-too-large'));
    expect(result.omittedPatches['small.txt']).toBeUndefined();
  });

  it('keeps listing the changes when git cannot diff them, as in a repository without a commit yet', async () => {
    const [dir] = await seedRepositories();
    await writeFile(join(dir!, 'first.txt'), 'hello\n');

    const result = await listSessionWorkspacePatches(makeSession(), 'branch');

    expect(result.available).toBe(true);
    expect(result.changes.map(change => [change.path, change.status])).toEqual([['first.txt', 'untracked']]);
    expect(result.patches).toEqual({});
    expect(result.omittedPatches).toEqual({});
  });

  it('keys each repository’s diffs by its prefixed path', async () => {
    const [repoDir, docsDir] = await seedRepositories(['acme/repo', 'acme/docs']);
    const session = makeSession({ baseBranch: 'main' });
    recordSessionEnvironment(session.sessionId, {
      workingDirectory: join(repoDir!, '..'),
      repositories: [
        {
          slug: 'acme/repo',
          dir: repoDir!,
          branch: 'factory/issue-1',
          defaultBranch: 'main',
          position: 1,
          setupStatus: 'ok',
        },
        { slug: 'acme/docs', dir: docsDir!, branch: 'main', defaultBranch: 'main', position: 2, setupStatus: 'ok' },
      ],
    });
    for (const dir of [repoDir!, docsDir!]) {
      await writeFile(join(dir, 'README.md'), 'base\n');
      await commitAll(dir, 'base');
      await publishBase(dir);
      await writeFile(join(dir, 'README.md'), `changed in ${dir.split('/').at(-1)}\n`);
    }

    const result = await listSessionWorkspacePatches(session, 'branch');
    __clearSessionEnvironmentsForTests();

    expect(result.changes.map(change => change.path)).toEqual(['docs/README.md', 'repo/README.md']);
    expect(result.patches['docs/README.md']).toContain('+changed in docs\n');
    expect(result.patches['repo/README.md']).toContain('+changed in repo\n');
  });

  it('rejects a scope it does not know', async () => {
    const { deps } = makeSessionFs();
    const request = await requestSessionRoute('/web/workspace/changes/patches', deps);

    const response = await request(`?workspacePath=${makeSession().sessionId}&scope=last-turn`);

    expect(response.status).toBe(400);
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
    answer: (dir: string, kind: 'merge-base' | 'status' | 'tracked' | 'numstat' | 'other', args: string[]) => Answer,
    { recorded = ['acme/repo', 'acme/docs', 'acme/site'] }: { recorded?: string[] } = {},
  ) {
    const executeCommand = vi.fn(async (command: string, args: string[] = []) => {
      const dirIndex = args.indexOf('-C');
      const dir = dirIndex >= 0 ? args[dirIndex + 1]! : (args[3] ?? '');
      const kind =
        command === 'git' && args[2] === 'merge-base'
          ? 'merge-base'
          : command === 'git' && args[2] === 'status'
            ? 'status'
            : command === 'git' && args[2] === 'diff'
              ? 'tracked'
              : args.includes('--numstat')
                ? 'numstat'
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

  it('reads a root artifact and a prefixed file on the workspace root filesystem', async () => {
    const files: Record<string, string> = {
      [`${ROOT}/.artifacts/report.md`]: '# Report',
      [`${ROOT}/docs/guide.md`]: '# Guide',
    };
    const { session } = seedEnvironment((_dir, _kind, args) => {
      const script = args[1] ?? '';
      const check = treeCheck(args);
      if (check) return check;
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
