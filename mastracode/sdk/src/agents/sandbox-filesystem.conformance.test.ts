/**
 * SandboxFilesystem conformance tests.
 *
 * Runs the shared `@internal/workspace-test-utils` filesystem suite against a
 * `SandboxFilesystem` backed by a real local shell (`sh -c` on the host, the
 * same executor a LocalSandbox uses). This exercises every shell-quoted code
 * path — base64 reads/writes, the portable stat/readdir fallbacks — on the
 * host OS, so running it on macOS covers the BSD variants and CI covers GNU.
 */

import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
import { LocalFilesystem } from '@mastra/core/workspace';
import { afterAll, describe, expect, it } from 'vitest';

import type { SandboxCommandResult, SandboxExec } from './sandbox-filesystem';
import { SandboxFilesystem } from './sandbox-filesystem';

/** Minimal SandboxExec that runs commands on the host, like LocalSandbox does. */
function createLocalShellExec(): SandboxExec {
  return {
    id: 'local-shell-test',
    executeCommand(command, args = [], options): Promise<SandboxCommandResult> {
      return new Promise(resolve => {
        execFile(
          command,
          args,
          { timeout: options?.timeout, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
          (error, stdout, stderr) => {
            const exitCode =
              error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
                ? ((error as unknown as { code: number }).code ?? 1)
                : error
                  ? 1
                  : 0;
            resolve({ exitCode, stdout, stderr });
          },
        );
      });
    },
  };
}

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
});

function createSandboxFilesystem(): SandboxFilesystem {
  // realpathSync: on macOS tmpdir() is a symlink (/var -> /private/var); the
  // filesystem's realpath containment guard needs the resolved workdir.
  const workdir = realpathSync(mkdtempSync(join(tmpdir(), 'mastra-sandbox-fs-')));
  tmpDirs.push(workdir);
  return new SandboxFilesystem({ sandbox: createLocalShellExec(), workdir });
}

createFilesystemTestSuite({
  suiteName: 'SandboxFilesystem Conformance (local shell)',
  createFilesystem: () => createSandboxFilesystem(),
  capabilities: {
    supportsAppend: true,
    supportsBinaryFiles: true,
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsEmptyDirectories: true,
    deleteThrowsOnMissing: true,
    supportsConcurrency: true,
    supportsPermissions: false,
    supportsMounting: false,
    // Write payloads travel as base64 inside a single `sh -c` argument.
    // macOS bounds the whole argument list by ARG_MAX (~1MB), but Linux also
    // caps a *single* argument at MAX_ARG_STRLEN (128 KiB). base64 inflates the
    // payload by 4/3, so a 128 KiB file becomes a ~171 KiB argument and fails
    // with E2BIG before the shell ever runs. Keep the payload well under that
    // per-argument ceiling — and note this is a real limit of the write path
    // (base64 in one argument), not just a test-size choice.
    maxTestFileSize: 64 * 1024,
  },
  // Every operation shells out (often several commands), so give slow CI
  // hosts more headroom than the 5s default.
  testTimeout: 20000,
});

/**
 * Same suite with the sandbox exposing a native filesystem (the host disk,
 * unconfined, standing in for a provider's file API). Proves the delegation
 * wiring — absolute paths, workspace-relative `stat` paths, which operations
 * delegate and which stay on the shell — against the shared contract.
 */
createFilesystemTestSuite({
  suiteName: 'SandboxFilesystem Conformance (native filesystem)',
  createFilesystem: () => {
    const workdir = realpathSync(mkdtempSync(join(tmpdir(), 'mastra-sandbox-native-fs-')));
    tmpDirs.push(workdir);
    const sandbox = { ...createLocalShellExec(), filesystem: new LocalFilesystem({ basePath: '/', contained: false }) };
    return new SandboxFilesystem({ sandbox, workdir });
  },
  capabilities: {
    supportsAppend: true,
    supportsBinaryFiles: true,
    supportsForceDelete: true,
    supportsOverwrite: true,
    supportsEmptyDirectories: true,
    deleteThrowsOnMissing: true,
    supportsConcurrency: true,
    supportsPermissions: false,
    supportsMounting: false,
    // appendFile and no-overwrite writes still travel as one base64 argument.
    maxTestFileSize: 64 * 1024,
  },
  testTimeout: 20000,
});

describe('SandboxFilesystem.walk ignore options (local shell)', () => {
  it('keeps .gitignore files and prunes skipped directories', async () => {
    const filesystem = createSandboxFilesystem();
    await filesystem.writeFile('app/.gitignore', 'dist\n');
    await filesystem.writeFile('app/.env', 'SECRET=1\n');
    await filesystem.writeFile('app/src/a.ts', 'a\n');
    await filesystem.writeFile('app/node_modules/dep/i.js', 'i\n');

    const paths = (entries: Array<{ path: string }>) => entries.map(entry => entry.path).sort();

    expect(paths(await filesystem.walk('.'))).toEqual([
      'app',
      'app/node_modules',
      'app/node_modules/dep',
      'app/node_modules/dep/i.js',
      'app/src',
      'app/src/a.ts',
    ]);
    expect(
      paths(await filesystem.walk('.', { includeGitignoreFiles: true, skipDirectoryNames: ['node_modules'] })),
    ).toEqual(['app', 'app/.gitignore', 'app/src', 'app/src/a.ts']);
    expect(paths(await filesystem.walk('app/node_modules', { skipDirectoryNames: ['node_modules'] }))).toEqual([
      'dep',
      'dep/i.js',
    ]);
  });
});

/**
 * The GNU grep path (no ripgrep) against a real multi-repo tree. Runs only
 * where the host has GNU grep and git (Linux CI); ripgrep is hidden from the
 * filesystem's tool probe so this path is used even when rg is installed.
 */
const hostHasGnuGrepAndGit = (() => {
  try {
    return (
      execFileSync('grep', ['--version'], { encoding: 'utf8' }).includes('GNU grep') &&
      execFileSync('git', ['--version'], { encoding: 'utf8' }).startsWith('git version')
    );
  } catch {
    return false;
  }
})();

/** Whether host grep and git both run PCRE (`-P`); git can be built without it. */
const hostHasPcre = (() => {
  try {
    execFileSync('sh', ['-c', "printf 'a1\\n' | grep -qP '\\d(?=)'"]);
    const repo = mkdtempSync(join(tmpdir(), 'mastra-pcre-probe-'));
    try {
      execFileSync('sh', ['-c', "git init -q && printf 'a1\\n' >f && git grep -q --untracked -P -e '\\d(?=)'"], {
        cwd: repo,
        stdio: 'ignore',
      });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hostHasGnuGrepAndGit)('SandboxFilesystem.grep with GNU grep and git (local shell)', () => {
  function write(root: string, file: string, content: string) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }

  function createWorkspace(): string {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'mastra-sandbox-grep-')));
    tmpDirs.push(root);
    const repo = join(root, 'app');
    write(root, 'app/.gitignore', 'node_modules\n/dist\n');
    write(root, 'app/pkg/.gitignore', 'gen/\n');
    write(root, 'app/src/a.ts', 'before\nconst isBot: true\nafter\n');
    write(root, 'app/src/new.ts', 'isBot: untracked\n');
    write(root, 'app/node_modules/dep/i.js', 'isBot: dependency\n');
    write(root, 'app/pkg/gen/g.ts', 'isBot: generated\n');
    write(root, 'app/dist/d.js', 'isBot: build output\n');
    write(root, 'loose/l.txt', 'isBot: outside a repository\n');
    write(root, 'loose/node_modules/p/a.js', 'isBot: loose dependency\n');
    const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'ignore' });
    git('init', '-q');
    git('add', '.gitignore', 'pkg/.gitignore', 'src/a.ts');
    return root;
  }

  function createGnuFilesystem(root: string): SandboxFilesystem {
    const shell = createLocalShellExec();
    const sandbox: SandboxExec = {
      id: shell.id,
      async executeCommand(command, args, options) {
        const result = await shell.executeCommand(command, args, options);
        if (!args?.[1]?.startsWith('command -v rg')) return result;
        return { ...result, stdout: result.stdout.replace(/^rg\n/m, '') };
      },
    };
    return new SandboxFilesystem({ sandbox, workdir: root });
  }

  const grep = (fs: SandboxFilesystem, path: string, contextLines = 0) =>
    fs.grep({ pattern: 'isBot:', path, caseSensitive: true, includeHidden: false, contextLines });

  it('applies every repository .gitignore, skips node_modules, and returns context', async () => {
    const root = createWorkspace();
    const results = await grep(createGnuFilesystem(root), '.', 1);

    expect(results.map(result => result.path).sort()).toEqual(['app/src/a.ts', 'app/src/new.ts', 'loose/l.txt']);
    expect(results.find(result => result.path === 'app/src/a.ts')!.matches).toEqual([
      { line: 2, column: 6, text: 'const isBot: true', before: ['before'], after: ['after'] },
    ]);
  });

  it('still searches an ignored directory when the path points at it', async () => {
    const root = createWorkspace();
    const fs = createGnuFilesystem(root);

    expect((await grep(fs, 'app/node_modules')).map(result => result.path)).toEqual(['dep/i.js']);
    expect((await grep(fs, 'app/dist')).map(result => result.path)).toEqual(['d.js']);
  });

  it.skipIf(!hostHasPcre)('runs \\b, \\s, \\w, and lookarounds natively when grep and git support -P', async () => {
    const root = createWorkspace();
    const results = await createGnuFilesystem(root).grep({
      pattern: '\\bisBot:\\s(?=[a-z])\\w+',
      path: '.',
      caseSensitive: true,
      includeHidden: false,
    });

    expect(results.map(result => result.path).sort()).toEqual(['app/src/a.ts', 'app/src/new.ts', 'loose/l.txt']);
    expect(results.find(result => result.path === 'app/src/a.ts')!.matches[0]).toMatchObject({ line: 2, column: 6 });
  });
});
