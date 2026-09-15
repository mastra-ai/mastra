import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __clearSessionSandboxesForTests, getSessionSandbox } from '../sandbox/session-sandbox.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';

afterEach(() => {
  __clearSessionSandboxesForTests();
});
import {
  buildFsRoutes,
  listArtifacts,
  listSessionRenderedPath,
  listSessionWorkspaceChanges,
  listWorkspaceRenderedPath,
  parseWorkspaceChanges,
  parseWorkspaceChangeStats,
  readSessionWorkspaceDiff,
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
  { sessionRowId = 'row-1', workdir = WORKDIR } = {},
) {
  const executeCommand = vi.fn(async (command: string, args: string[] = []) => {
    const script = args[1] ?? '';
    const result = respond(script, command, args);
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr ?? '' };
  });
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
      }) as never,
  );
  return { executeCommand };
}

function makeSessionFs({
  session = makeSession(),
  files = [{ path: 'src/agent.ts' }],
}: {
  session?: SourceControlSession;
  files?: Array<{ path: string }>;
} = {}) {
  const ensureUser = vi.fn(async () => undefined);
  const listFiles = vi.fn(async () => files);
  return {
    ensureUser,
    listFiles,
    deps: {
      auth: {
        enabled: () => true,
        ensureUser,
        tenant: () => ({ orgId: session.orgId, userId: session.userId }),
        isOrganizationAdmin: async () => false,
      },
      sessions: { getBySessionId: vi.fn(async () => session) },
      filesystem: { listFiles },
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

describe('persisted session workspace files routes', () => {
  it('authorizes before reading the persisted list and scopes it to the requested thread', async () => {
    const { deps, ensureUser, listFiles } = makeSessionFs();
    const request = await requestSessionRoute('/web/workspace/files', deps);

    const response = await request(`?workspacePath=${makeSession().sessionId}&threadId=thread-1`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      workspacePath: makeSession().sessionId,
      threadId: 'thread-1',
      files: [{ path: 'src/agent.ts' }],
    });
    expect(ensureUser).toHaveBeenCalledTimes(1);
    expect(listFiles).toHaveBeenCalledWith({ resourceId: makeSession().sessionId, threadId: 'thread-1' });
  });

  it('rejects a missing thread id without querying the database', async () => {
    const { deps, listFiles } = makeSessionFs();
    const request = await requestSessionRoute('/web/workspace/files', deps);

    const response = await request(`?workspacePath=${makeSession().sessionId}`);

    expect(response.status).toBe(400);
    expect(listFiles).not.toHaveBeenCalled();
  });

  it.each([
    ['/web/workspace/files', `?workspacePath=${makeSession().sessionId}&threadId=%20`],
    ['/web/workspace/file', `?workspacePath=${makeSession().sessionId}&threadId=%20&path=src/agent.ts`],
  ])('rejects a whitespace-only thread id on %s', async (route, query) => {
    const { deps, ensureUser, listFiles } = makeSessionFs();
    const request = await requestSessionRoute(route, deps);

    const response = await request(query);

    expect(response.status).toBe(400);
    expect(ensureUser).not.toHaveBeenCalled();
    expect(listFiles).not.toHaveBeenCalled();
  });

  it('isolates rows for a different thread', async () => {
    const { deps, listFiles } = makeSessionFs({ files: [] });
    const request = await requestSessionRoute('/web/workspace/files', deps);

    const response = await request(`?workspacePath=${makeSession().sessionId}&threadId=thread-2`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspacePath: makeSession().sessionId, threadId: 'thread-2', files: [] });
    expect(listFiles).toHaveBeenCalledWith({ resourceId: makeSession().sessionId, threadId: 'thread-2' });
  });

  it('rejects an unlisted path before accessing the sandbox', async () => {
    const { deps } = makeSessionFs();
    const request = await requestSessionRoute('/web/workspace/file', deps);

    const response = await request(`?workspacePath=${makeSession().sessionId}&threadId=thread-1&path=secret.env`);

    expect(response.status).toBe(404);
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

  it('rejects reads outside approved rendered roots', async () => {
    const { executeCommand } = seedSessionSandbox(respondForFile('secret'));

    await expect(readSessionWorkspaceFile(makeSession(), '.ssh/config')).rejects.toThrow(
      'Root is not approved for rendered workspace access',
    );
    expect(executeCommand).not.toHaveBeenCalled();
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
      expect(args.slice(2)).toEqual(['mastracode-numstat', WORKDIR]);
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
    expect(executeCommand).toHaveBeenCalledTimes(2);
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
        'HEAD',
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
    expect(executeCommand).toHaveBeenCalledTimes(1);
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
        'HEAD',
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
        'HEAD',
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
    expect(executeCommand).toHaveBeenCalledTimes(3);
  });

  it('rejects diff paths that escape the workspace before running git', async () => {
    const { executeCommand } = seedSessionSandbox(() => ({ exitCode: 0, stdout: '' }));

    await expect(readSessionWorkspaceDiff(makeSession(), '../secret')).rejects.toThrow('path escapes workspace');
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
