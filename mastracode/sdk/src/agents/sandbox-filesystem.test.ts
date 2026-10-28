import type { WorkspaceFilesystem } from '@mastra/core/workspace';
import { FileNotFoundError } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';
import { SandboxFilesystem } from './sandbox-filesystem.js';
import type { SandboxCommandResult, SandboxExec } from './sandbox-filesystem.js';

/**
 * Fake sandbox that records every command and returns scripted results. Lets us
 * assert the exact shell the filesystem issues without a real VM.
 */
class FakeSandbox implements SandboxExec {
  readonly id = 'fake-sandbox';
  readonly calls: string[] = [];
  readonly options: Array<{ timeout?: number; maxRetainedBytes?: number } | undefined> = [];
  private responder: (script: string) => SandboxCommandResult;

  constructor(responder?: (script: string) => SandboxCommandResult) {
    this.responder = responder ?? (() => ({ exitCode: 0, stdout: '', stderr: '' }));
  }

  async executeCommand(
    command: string,
    args?: string[],
    options?: { timeout?: number; maxRetainedBytes?: number },
  ): Promise<SandboxCommandResult> {
    // The filesystem always shells via `sh -c <script>`.
    const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
    this.calls.push(script);
    this.options.push(options);
    return this.responder(script);
  }
}

const WORKDIR = '/workspace/repo';

/** The realpath containment guard script starts by assigning the target path. */
function isContainmentCheck(script: string): boolean {
  return script.startsWith('p=');
}

/** Containment guard output: canonicalized root on line 1, target realpath on line 2. */
function realpathResult(real: string): SandboxCommandResult {
  return { exitCode: 0, stdout: `${WORKDIR}\n${real}`, stderr: '' };
}

function makeFs(responder?: (script: string) => SandboxCommandResult) {
  const wrapped = (script: string): SandboxCommandResult => {
    if (responder) return responder(script);
    // Default: containment checks resolve inside the workdir, everything else succeeds.
    if (isContainmentCheck(script)) return realpathResult(WORKDIR);
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const sandbox = new FakeSandbox(wrapped);
  const fs = new SandboxFilesystem({ sandbox, workdir: WORKDIR });
  return { sandbox, fs };
}

describe('SandboxFilesystem', () => {
  it('reads a file via base64 and decodes it', async () => {
    const content = 'hello world';
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    const { sandbox, fs } = makeFs(script => {
      // The realpath containment check runs first; resolve it inside the workdir.
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/src/index.ts`);
      return { exitCode: 0, stdout: b64, stderr: '' };
    });

    const result = await fs.readFile('/src/index.ts', { encoding: 'utf8' });

    expect(result).toBe(content);
    expect(sandbox.calls.some(c => c.includes(`base64 < '${WORKDIR}/src/index.ts'`))).toBe(true);
  });

  it('asks the sandbox to retain all command output', async () => {
    // Sandboxes keep only the newest 1 MiB of output by default; a base64 file
    // read or a long listing must not lose its head.
    const { sandbox, fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/big.bin`);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await fs.readFile('/big.bin');

    expect(sandbox.options.length).toBeGreaterThan(0);
    for (const options of sandbox.options) {
      expect(options?.maxRetainedBytes).toBe(Infinity);
    }
  });

  it('rejects a symlink whose realpath escapes the workspace root', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult('/etc/passwd');
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.readFile('/link')).rejects.toThrow(/escapes workspace root \(symlink\)/);
  });

  it('fails closed when an existing path cannot be canonicalized', async () => {
    // If no canonicalization tool works, skipping the check would let a
    // symlink bypass containment — the operation must fail instead.
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.readFile('/link')).rejects.toThrow(/Unable to verify path stays within workspace root/);
    expect(sandbox.calls.some(c => c.includes('base64 <'))).toBe(false);
  });

  it('rejects a write whose parent directory is a symlink escaping the workspace', async () => {
    // The leaf doesn't exist yet, but its parent `evil` resolves to /etc, so
    // the containment check on the parent returns an out-of-root realpath.
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult('/etc');
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.writeFile('/evil/passwd', 'x')).rejects.toThrow(/escapes workspace root \(symlink\)/);
    // The write command must never have run.
    expect(sandbox.calls.some(c => c.includes('base64 -d >'))).toBe(false);
  });

  it('rejects deleting a file whose parent directory is a symlink escaping the workspace', async () => {
    // `evil` is an in-workdir symlink to /etc — deleting `evil/passwd` would
    // remove a file outside the workspace.
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult('/etc');
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.deleteFile('/evil/passwd')).rejects.toThrow(/escapes workspace root \(symlink\)/);
    expect(sandbox.calls.some(c => c.includes('rm '))).toBe(false);
  });

  it('rejects recursive rmdir whose parent directory is a symlink escaping the workspace', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult('/etc');
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.rmdir('/evil/dir', { recursive: true })).rejects.toThrow(/escapes workspace root \(symlink\)/);
    expect(sandbox.calls.some(c => c.includes('rm -r'))).toBe(false);
  });

  it('allows a write when the parent realpath stays inside the workspace', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/src`);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await fs.writeFile('/src/new.ts', 'x');
    expect(sandbox.calls.some(c => c.includes('base64 -d >'))).toBe(true);
  });

  it('passes a command timeout to the sandbox', async () => {
    const timeouts: Array<number | undefined> = [];
    const sandbox: SandboxExec = {
      id: 'fake',
      async executeCommand(_cmd, _args, options) {
        timeouts.push(options?.timeout);
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const fs = new SandboxFilesystem({ sandbox, workdir: WORKDIR });
    await fs.exists('/x');
    expect(timeouts[0]).toBe(30_000);
  });

  it('writes a file by piping base64 into the resolved path', async () => {
    const { sandbox, fs } = makeFs();

    await fs.writeFile('/notes.txt', 'data');

    const b64 = Buffer.from('data', 'utf8').toString('base64');
    const writeCall = sandbox.calls.find(c => c.includes('base64 -d >'));
    expect(writeCall).toContain(`mkdir -p '${WORKDIR}'`);
    expect(writeCall).toContain(`printf %s '${b64}' | base64 -d > '${WORKDIR}/notes.txt'`);
  });

  it('lists a directory and parses type/name pairs', async () => {
    const { sandbox, fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      return { exitCode: 0, stdout: 'd\tsrc\nf\tREADME.md\n', stderr: '' };
    });

    const entries = await fs.readdir('/');

    expect(entries).toEqual([
      { name: 'src', type: 'directory' },
      { name: 'README.md', type: 'file' },
    ]);
    expect(sandbox.calls.some(c => c.includes(`cd '${WORKDIR}'`))).toBe(true);
  });

  it('stats a file and returns parsed metadata', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/a.txt`);
      return { exitCode: 0, stdout: 'regular file|42|1700000000|-1\n', stderr: '' };
    });

    const stat = await fs.stat('/a.txt');

    expect(stat.type).toBe('file');
    expect(stat.size).toBe(42);
    expect(stat.name).toBe('a.txt');
    expect(stat.path).toBe('/a.txt');
  });

  it('accepts absolute paths that already live under the workdir', async () => {
    // The agent prompt advertises the workdir as the working directory, so
    // tools are called with fully-qualified paths. These must resolve in
    // place instead of being re-joined onto the workdir.
    const { sandbox, fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/notes/review.md`);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await fs.writeFile(`${WORKDIR}/notes/review.md`, 'verdict');

    const writeCall = sandbox.calls.find(c => c.includes('base64 -d >'));
    expect(writeCall).toContain(`base64 -d > '${WORKDIR}/notes/review.md'`);
    expect(writeCall).not.toContain(`${WORKDIR}${WORKDIR}`);
  });

  it('normalizes .. segments inside an absolute workdir path', async () => {
    const { sandbox, fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/notes.txt`);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await fs.readFile(`${WORKDIR}/src/../notes.txt`);
    expect(sandbox.calls.some(c => c.includes(`base64 < '${WORKDIR}/notes.txt'`))).toBe(true);
  });

  it('falls back to BSD stat when GNU stat is unavailable', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/dir`);
      // Simulate macOS: the `stat -L -c || stat -L -f` compound runs BSD output.
      if (script.includes('stat -L -c')) {
        expect(script).toContain('stat -L -f');
        return { exitCode: 0, stdout: 'Directory|128|1700000000|1690000000\n', stderr: '' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const stat = await fs.stat('/dir');
    expect(stat.type).toBe('directory');
  });

  it('lists recursively without GNU find -printf', async () => {
    const { sandbox, fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      return { exitCode: 0, stdout: `d\t${WORKDIR}/src\nf\t${WORKDIR}/src/index.ts\n`, stderr: '' };
    });

    const entries = await fs.readdir('/', { recursive: true });

    expect(entries).toEqual([
      { name: 'src', type: 'directory' },
      { name: 'src/index.ts', type: 'file' },
    ]);
    const findCall = sandbox.calls.find(c => c.includes('find '));
    expect(findCall).not.toContain('-printf');
  });

  it('removes a file via rm', async () => {
    const { sandbox, fs } = makeFs();
    await fs.deleteFile('/old.txt', { force: true });
    expect(sandbox.calls.some(c => c.includes(`rm -f '${WORKDIR}/old.txt'`))).toBe(true);
  });

  it('reports existence from the exit code', async () => {
    const { fs: existsFs } = makeFs(() => ({ exitCode: 0, stdout: '', stderr: '' }));
    const { fs: missingFs } = makeFs(() => ({ exitCode: 1, stdout: '', stderr: '' }));
    await expect(existsFs.exists('/x')).resolves.toBe(true);
    await expect(missingFs.exists('/x')).resolves.toBe(false);
  });

  it('rejects paths that escape the workspace root', async () => {
    const { fs } = makeFs();
    await expect(fs.readFile('/../../etc/passwd')).rejects.toThrow(/escapes workspace root/);
    await expect(fs.writeFile('/../secret', 'x')).rejects.toThrow(/escapes workspace root/);
  });

  it('exposes basePath and a sandbox-derived id', () => {
    const { fs } = makeFs();
    expect(fs.basePath).toBe(WORKDIR);
    expect(fs.id).toBe(`sandbox-fs:fake-sandbox:${WORKDIR}`);
    expect(fs.getInfo().metadata).toMatchObject({ basePath: WORKDIR, sandboxId: 'fake-sandbox' });
  });

  describe('lazy workdir', () => {
    it('resolves the workdir once on first use and memoizes it', async () => {
      let resolves = 0;
      const sandbox = new FakeSandbox(script =>
        isContainmentCheck(script) ? realpathResult(`${WORKDIR}/a.txt`) : { exitCode: 0, stdout: '', stderr: '' },
      );
      const fs = new SandboxFilesystem({
        sandbox,
        workdir: async () => {
          resolves += 1;
          return WORKDIR;
        },
      });
      // Unresolved: no sync absolute form, empty basePath, sandbox-only id.
      expect(fs.basePath).toBe('');
      expect(fs.resolveAbsolutePath('/a.txt')).toBeUndefined();
      expect(fs.id).toBe('sandbox-fs:fake-sandbox');

      await fs.exists('/a.txt');
      await fs.exists('/b.txt');

      expect(resolves).toBe(1);
      expect(fs.basePath).toBe(WORKDIR);
      expect(fs.resolveAbsolutePath('/a.txt')).toBe(`${WORKDIR}/a.txt`);
      expect(sandbox.calls.some(c => c.includes(`test -e '${WORKDIR}/a.txt'`))).toBe(true);
    });

    it('does not memoize a failed resolution', async () => {
      let attempt = 0;
      const sandbox = new FakeSandbox();
      const fs = new SandboxFilesystem({
        sandbox,
        workdir: async () => {
          attempt += 1;
          if (attempt === 1) throw new Error('VM not up');
          return WORKDIR;
        },
      });
      await expect(fs.exists('/a.txt')).rejects.toThrow('VM not up');
      await expect(fs.exists('/a.txt')).resolves.toBe(true);
      expect(fs.basePath).toBe(WORKDIR);
    });
  });
});

describe('SandboxFilesystem.walk', () => {
  it('walks the tree in one find command and classifies entries', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.includes('find ')) {
        return {
          exitCode: 0,
          stdout: [
            `d\t${WORKDIR}/src`,
            `f\t${WORKDIR}/src/index.ts`,
            `d\t${WORKDIR}/src/utils`,
            `f\t${WORKDIR}/src/utils/helpers.ts`,
            `F\t${WORKDIR}/link.ts\tsrc/index.ts`,
            `D\t${WORKDIR}/linkdir\t/elsewhere`,
          ].join('\n'),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const entries = await fs.walk('.');

    expect(entries).toEqual([
      { name: 'src', type: 'directory', path: 'src' },
      { name: 'index.ts', type: 'file', path: 'src/index.ts' },
      { name: 'utils', type: 'directory', path: 'src/utils' },
      { name: 'helpers.ts', type: 'file', path: 'src/utils/helpers.ts' },
      { name: 'link.ts', type: 'file', isSymlink: true, symlinkTarget: 'src/index.ts', path: 'link.ts' },
      { name: 'linkdir', type: 'directory', isSymlink: true, symlinkTarget: '/elsewhere', path: 'linkdir' },
    ]);
    // Exactly one find invocation regardless of tree depth.
    expect(sandbox.calls.filter(c => c.includes('find ')).length).toBe(1);
  });

  it('passes maxDepth and prunes hidden entries by default', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await fs.walk('.', { maxDepth: 3 });
    const findCall = sandbox.calls.find(c => c.includes('find '))!;
    expect(findCall).toContain('-maxdepth 3');
    expect(findCall).toContain(`\\( -name '.*' \\) -prune -o`);

    await fs.walk('.', { includeHidden: true });
    const hiddenCall = sandbox.calls.filter(c => c.includes('find ')).at(-1)!;
    expect(hiddenCall).not.toContain('-prune');
  });

  it('throws DirectoryNotFoundError when the root is missing', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      return { exitCode: 20, stdout: '', stderr: '' };
    });
    await expect(fs.walk('./missing')).rejects.toMatchObject({ name: 'DirectoryNotFoundError', code: 'ENOENT' });
  });

  it('throws NotDirectoryError when the root is a file', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      return { exitCode: 23, stdout: '', stderr: '' };
    });
    await expect(fs.walk('./file.txt')).rejects.toMatchObject({ name: 'NotDirectoryError', code: 'ENOTDIR' });
  });
});

describe('SandboxFilesystem.grep', () => {
  function rgEvent(type: string, filePath: string, lineNumber: number, text: string, byteStart?: number) {
    return JSON.stringify({
      type,
      data: {
        path: { text: filePath },
        line_number: lineNumber,
        lines: { text: `${text}\n` },
        ...(type === 'match' ? { submatches: [{ start: byteStart ?? 0, end: (byteStart ?? 0) + 1 }] } : {}),
      },
    });
  }

  it('uses rg --json when ripgrep is available and converts byte offsets to UTF-16 columns', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) {
        return {
          exitCode: 0,
          stdout: [
            // "héllo foo" — 'é' is 2 bytes in UTF-8 but 1 UTF-16 unit, so
            // "foo" starts at byte 7 and string index 6.
            rgEvent('match', `${WORKDIR}/src/a.ts`, 3, 'héllo foo', 7),
            rgEvent('match', `${WORKDIR}/b.ts`, 1, 'foo', 0),
          ].join('\n'),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const results = await fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false });

    expect(results).toEqual([
      { path: 'src/a.ts', matches: [{ line: 3, column: 6, text: 'héllo foo' }] },
      { path: 'b.ts', matches: [{ line: 1, column: 0, text: 'foo' }] },
    ]);
    expect(sandbox.calls.filter(c => c.startsWith('rg ')).length).toBe(1);
  });

  it('assembles before/after context from rg context events', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) {
        return {
          exitCode: 0,
          stdout: [
            rgEvent('context', `${WORKDIR}/a.ts`, 1, 'line one'),
            rgEvent('match', `${WORKDIR}/a.ts`, 2, 'foo here', 0),
            rgEvent('context', `${WORKDIR}/a.ts`, 3, 'line three'),
          ].join('\n'),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const results = await fs.grep({
      pattern: 'foo',
      path: '.',
      caseSensitive: true,
      includeHidden: false,
      contextLines: 1,
    });

    expect(results).toEqual([
      {
        path: 'a.ts',
        matches: [{ line: 2, column: 0, text: 'foo here', before: ['line one'], after: ['line three'] }],
      },
    ]);
  });

  it('returns [] when rg exits 1 (no matches)', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'nope', path: '.', caseSensitive: true, includeHidden: false })).resolves.toEqual(
      [],
    );
  });

  it('keeps partial matches when rg exits 2 because of a per-file error', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) {
        return {
          exitCode: 2,
          stdout: rgEvent('match', `${WORKDIR}/a.ts`, 1, 'foo', 0),
          stderr: 'rg: secret.txt: Permission denied (os error 13)',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false })).resolves.toEqual([
      { path: 'a.ts', matches: [{ line: 1, column: 0, text: 'foo' }] },
    ]);
  });

  it('signals UnsupportedGrepPatternError when rg exits 2 with no output (bad pattern)', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) return { exitCode: 2, stdout: '', stderr: 'regex parse error' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(
      fs.grep({ pattern: 'foo(?<=x)', path: '.', caseSensitive: true, includeHidden: false }),
    ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
  });

  it('falls back to grep -rnE when rg is missing and recomputes columns', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.startsWith('grep ')) {
        return {
          exitCode: 0,
          stdout: [`${WORKDIR}/src/a.ts:2:const foo = 1;`, `${WORKDIR}/src/a.ts:5:let foobar;`].join('\n'),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const results = await fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false });

    expect(results).toEqual([
      {
        path: 'src/a.ts',
        matches: [
          { line: 2, column: 6, text: 'const foo = 1;' },
          { line: 5, column: 4, text: 'let foobar;' },
        ],
      },
    ]);
    expect(sandbox.calls.some(c => c.startsWith('grep -rnIE'))).toBe(true);
  });

  it('signals UnsupportedGrepPatternError for patterns ERE cannot express', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    for (const pattern of ['\\bfoo\\b', '\\d+', 'foo(?=bar)', 'a+?', '[[:digit:]]+', '\\<foo\\>', 'foo[']) {
      await expect(fs.grep({ pattern, path: '.', caseSensitive: true, includeHidden: false })).rejects.toMatchObject({
        code: 'EUNSUPPORTED_PATTERN',
      });
    }
  });

  it('signals fallback when grep matched a line the JS regex cannot (dialect mismatch)', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.startsWith('grep ')) return { exitCode: 0, stdout: `${WORKDIR}/a.ts:1:zzz`, stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(
      fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false }),
    ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
  });

  it('signals fallback when context is requested and only POSIX grep is available', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(
      fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false, contextLines: 2 }),
    ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
  });

  it('runs rg with ignore files applied and node_modules skipped', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) {
        return realpathResult(script.includes('node_modules') ? `${WORKDIR}/node_modules/x` : WORKDIR);
      }
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\n', stderr: '' };
      return { exitCode: 1, stdout: '', stderr: '' };
    });

    await fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false });
    await fs.grep({ pattern: 'foo', path: 'node_modules/x', caseSensitive: true, includeHidden: false });

    const [rootSearch, nodeModulesSearch] = sandbox.calls.filter(c => c.startsWith('rg '));
    expect(rootSearch).not.toContain('--no-ignore');
    expect(rootSearch).toContain('--no-require-git');
    expect(rootSearch).toContain(`-g '!**/node_modules/**'`);
    // Searching inside node_modules on purpose still works.
    expect(nodeModulesSearch).not.toContain('node_modules/**');
  });

  describe('GNU grep without ripgrep', () => {
    const gnuProbe = { exitCode: 0, stdout: 'gnu-grep\ngit\n', stderr: '' };

    it('retries a failed tool probe on the next search instead of caching it', async () => {
      let probes = 0;
      const { fs } = makeFs(script => {
        if (isContainmentCheck(script)) return realpathResult(WORKDIR);
        if (script.startsWith('command -v rg')) {
          probes++;
          return probes === 1 ? { exitCode: 1, stdout: '', stderr: 'sandbox not ready' } : gnuProbe;
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });
      const search = () => fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false });

      await search();
      await search();
      await search();

      expect(probes).toBe(2);
    });

    it('returns matches with context from one command, resolving paths per repository', async () => {
      const { fs, sandbox } = makeFs(script => {
        if (isContainmentCheck(script)) return realpathResult(WORKDIR);
        if (script.startsWith('command -v rg')) return gnuProbe;
        if (script.startsWith('pat=')) {
          return {
            exitCode: 0,
            stdout: [
              `\0${WORKDIR}/app`,
              'src/a.ts\x001-before',
              'src/a.ts\x002:const foo = 1;',
              'src/a.ts\x003-after',
              '--',
              'src/a.ts\x009:foo again',
              `\0${WORKDIR}`,
              `${WORKDIR}/notes.txt\x001:foo: a colon-1-like line`,
              '',
            ].join('\n'),
            stderr: '',
          };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      const results = await fs.grep({
        pattern: 'foo',
        path: '.',
        caseSensitive: true,
        includeHidden: false,
        contextLines: 1,
      });

      expect(results).toEqual([
        {
          path: 'app/src/a.ts',
          matches: [
            { line: 2, column: 6, text: 'const foo = 1;', before: ['before'], after: ['after'] },
            { line: 9, column: 0, text: 'foo again', before: [], after: [] },
          ],
        },
        {
          path: 'notes.txt',
          matches: [{ line: 1, column: 0, text: 'foo: a colon-1-like line', before: [], after: [] }],
        },
      ]);
      const search = sandbox.calls.filter(c => c.startsWith('pat='));
      expect(search).toHaveLength(1);
      expect(search[0]).toContain('grep -HnIE --null -C 1');
      expect(search[0]).toContain('grep -l -z -I --untracked');
      expect(search[0]).toContain(`':(exclude,glob)**/node_modules/**'`);
    });

    it('signals fallback when grep rejects the pattern', async () => {
      const { fs } = makeFs(script => {
        if (isContainmentCheck(script)) return realpathResult(WORKDIR);
        if (script.startsWith('command -v rg')) return gnuProbe;
        if (script.startsWith('pat=')) return { exitCode: 2, stdout: '', stderr: 'grep: invalid regular expression' };
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      await expect(
        fs.grep({ pattern: 'a{1', path: '.', caseSensitive: true, includeHidden: false }),
      ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
    });

    it('signals fallback when grep and the JS regex disagree on a match', async () => {
      const { fs } = makeFs(script => {
        if (isContainmentCheck(script)) return realpathResult(WORKDIR);
        if (script.startsWith('command -v rg')) return gnuProbe;
        if (script.startsWith('pat=')) return { exitCode: 0, stdout: `\0${WORKDIR}\na.ts\x001:bar\n`, stderr: '' };
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      await expect(
        fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false }),
      ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
    });

    describe('with PCRE support', () => {
      const pcreProbe = { exitCode: 0, stdout: 'gnu-grep\ngrep-pcre\ngit\ngit-pcre\n', stderr: '' };

      it('runs \\d, \\s, \\b, and lookarounds natively with grep -P', async () => {
        const { fs, sandbox } = makeFs(script => {
          if (isContainmentCheck(script)) return realpathResult(WORKDIR);
          if (script.startsWith('command -v rg')) return pcreProbe;
          if (script.startsWith('pat=')) {
            return { exitCode: 0, stdout: `\0${WORKDIR}\na.ts\x003:  isBot: 42\n`, stderr: '' };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        });

        const results = await fs.grep({
          pattern: '\\bisBot:\\s(?=\\d)\\d+',
          path: '.',
          caseSensitive: true,
          includeHidden: false,
        });

        expect(results).toEqual([{ path: 'a.ts', matches: [{ line: 3, column: 2, text: '  isBot: 42' }] }]);
        const search = sandbox.calls.find(c => c.startsWith('pat='))!;
        expect(search).toContain('grep -HnIP --null');
        expect(search).toContain('--untracked -P -e "$pat"');
        expect(search).toContain('grep -P -e "$pat" </dev/null');
        expect(search).not.toContain('-E');
      });

      it('signals fallback for escapes PCRE and JS read differently', async () => {
        const { fs, sandbox } = makeFs(script => {
          if (isContainmentCheck(script)) return realpathResult(WORKDIR);
          if (script.startsWith('command -v rg')) return pcreProbe;
          return { exitCode: 0, stdout: '', stderr: '' };
        });

        for (const pattern of ['\\Afoo', 'foo\\z', '\\p{L}+', '[[:alpha:]]']) {
          await expect(
            fs.grep({ pattern, path: '.', caseSensitive: true, includeHidden: false }),
          ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
        }
        expect(sandbox.calls.some(c => c.startsWith('pat='))).toBe(false);
      });

      it('keeps ERE when git lacks PCRE', async () => {
        const { fs, sandbox } = makeFs(script => {
          if (isContainmentCheck(script)) return realpathResult(WORKDIR);
          if (script.startsWith('command -v rg')) {
            return { exitCode: 0, stdout: 'gnu-grep\ngrep-pcre\ngit\n', stderr: '' };
          }
          return { exitCode: 0, stdout: '', stderr: '' };
        });

        await expect(
          fs.grep({ pattern: '\\d+', path: '.', caseSensitive: true, includeHidden: false }),
        ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
        await fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false });
        expect(sandbox.calls.find(c => c.startsWith('pat='))).toContain('grep -HnIE --null');
      });
    });

    it('searches node_modules when the path points inside it', async () => {
      const { fs, sandbox } = makeFs(script => {
        if (isContainmentCheck(script)) return realpathResult(`${WORKDIR}/node_modules/x`);
        if (script.startsWith('command -v rg')) return gnuProbe;
        return { exitCode: 0, stdout: '', stderr: '' };
      });

      await fs.grep({ pattern: 'foo', path: 'node_modules/x', caseSensitive: true, includeHidden: false });

      const search = sandbox.calls.find(c => c.startsWith('pat='))!;
      expect(search).not.toContain('**/node_modules/**');
      expect(search).not.toContain('-name node_modules');
    });
  });

  it('includes the exit code and stderr in the rg failure reason', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) return { exitCode: 2, stdout: '', stderr: '\nregex parse error\nmore' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false })).rejects.toThrow(
      'exit code 2: regex parse error',
    );
  });

  it('reports a native grep timeout instead of an unsupported pattern', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: 'rg\ngit\n', stderr: '' };
      if (script.startsWith('rg ')) return { exitCode: 124, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false })).rejects.toThrow(
      'timed out after 30s',
    );
  });

  it('excludes .git from POSIX grep and keeps partial matches on exit 2', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.startsWith('grep ')) {
        return { exitCode: 2, stdout: `${WORKDIR}/a.ts:3:foo`, stderr: 'grep: secret.txt: Permission denied' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false })).resolves.toEqual([
      { path: 'a.ts', matches: [{ line: 3, column: 0, text: 'foo' }] },
    ]);
    expect(sandbox.calls.find(c => c.startsWith('grep '))).toContain('--exclude-dir=.git');
  });

  it('reports the POSIX grep failure reason when it fails without output', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.startsWith('grep ')) return { exitCode: 124, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false })).rejects.toThrow(
      'timed out after 30s',
    );
    await expect(fs.grep({ pattern: '\\bfoo', path: '.', caseSensitive: true, includeHidden: false })).rejects.toThrow(
      'POSIX ERE cannot express this syntax',
    );
  });

  it('applies the global match cap across files', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      if (script.startsWith('grep ')) {
        return {
          exitCode: 0,
          stdout: [`${WORKDIR}/a.ts:1:foo`, `${WORKDIR}/a.ts:2:foo`, `${WORKDIR}/b.ts:1:foo`].join('\n'),
          stderr: '',
        };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const results = await fs.grep({
      pattern: 'foo',
      path: '.',
      caseSensitive: true,
      includeHidden: false,
      maxTotalMatches: 2,
    });

    expect(results.flatMap(r => r.matches)).toHaveLength(2);
  });
});

describe('with a native sandbox filesystem', () => {
  /** Records native calls; returns plausible results. */
  function makeNative() {
    const calls: Array<[string, ...unknown[]]> = [];
    const record =
      <T>(name: string, result: (...args: any[]) => T) =>
      async (...args: unknown[]) => {
        calls.push([name, ...args]);
        return result(...args);
      };
    const native = {
      id: 'native',
      name: 'native',
      provider: 'test',
      status: 'ready',
      readFile: record('readFile', () => Buffer.from('hello')),
      writeFile: record('writeFile', () => undefined),
      appendFile: record('appendFile', () => undefined),
      deleteFile: record('deleteFile', () => undefined),
      copyFile: record('copyFile', () => undefined),
      moveFile: record('moveFile', () => undefined),
      mkdir: record('mkdir', () => undefined),
      rmdir: record('rmdir', () => undefined),
      readdir: record('readdir', () => [{ name: 'a.ts', type: 'file' }]),
      exists: record('exists', () => true),
      stat: record('stat', (abs: string) => ({
        name: abs.split('/').pop(),
        path: abs,
        type: 'file',
        size: 5,
        createdAt: new Date(0),
        modifiedAt: new Date(0),
      })),
    } as unknown as WorkspaceFilesystem;
    return { native, calls };
  }

  function makeNativeFs(
    options: { verifySymlinks?: boolean; responder?: (script: string) => SandboxCommandResult } = {},
  ) {
    const { native, calls } = makeNative();
    const sandbox = new FakeSandbox(
      options.responder ??
        (script => (isContainmentCheck(script) ? realpathResult(WORKDIR) : { exitCode: 0, stdout: '', stderr: '' })),
    );
    Object.assign(sandbox, { filesystem: native });
    const fs = new SandboxFilesystem({ sandbox, workdir: WORKDIR, verifySymlinks: options.verifySymlinks });
    return { sandbox, fs, calls };
  }

  it('runs single-entry operations natively with no shell commands', async () => {
    const { sandbox, fs, calls } = makeNativeFs();
    expect(await fs.readFile('/src/a.ts', { encoding: 'utf-8' })).toEqual(Buffer.from('hello'));
    await fs.writeFile('/src/a.ts', 'x');
    await fs.stat('/src/a.ts');
    await fs.exists('/src/a.ts');
    await fs.readdir('/src', { recursive: true });
    await fs.mkdir('/src/new');
    await fs.deleteFile('/src/a.ts', { force: true });
    await fs.rmdir('/src/new', { recursive: true });
    expect(sandbox.calls).toEqual([]);
    expect(calls).toEqual([
      ['readFile', `${WORKDIR}/src/a.ts`, { encoding: 'utf-8' }],
      ['writeFile', `${WORKDIR}/src/a.ts`, 'x', undefined],
      ['stat', `${WORKDIR}/src/a.ts`],
      ['exists', `${WORKDIR}/src/a.ts`],
      ['readdir', `${WORKDIR}/src`, { recursive: true }],
      ['mkdir', `${WORKDIR}/src/new`, undefined],
      ['deleteFile', `${WORKDIR}/src/a.ts`, { force: true }],
      ['rmdir', `${WORKDIR}/src/new`, { recursive: true }],
    ]);
  });

  it('runs appends, copies, moves and no-overwrite writes natively too', async () => {
    const { sandbox, fs, calls } = makeNativeFs();
    await fs.appendFile('/log.txt', 'x');
    await fs.copyFile('/a.ts', '/b.ts', { recursive: true });
    await fs.moveFile('/a.ts', '/c.ts', { overwrite: false });
    await fs.writeFile('/new.ts', 'x', { overwrite: false });
    expect(sandbox.calls).toEqual([]);
    expect(calls).toEqual([
      ['appendFile', `${WORKDIR}/log.txt`, 'x'],
      ['copyFile', `${WORKDIR}/a.ts`, `${WORKDIR}/b.ts`, { recursive: true }],
      ['moveFile', `${WORKDIR}/a.ts`, `${WORKDIR}/c.ts`, { overwrite: false }],
      ['writeFile', `${WORKDIR}/new.ts`, 'x', { overwrite: false }],
    ]);
  });

  it('checks both ends of a copy or move for escaping symlinks when asked', async () => {
    const { fs, calls } = makeNativeFs({
      verifySymlinks: true,
      responder: script =>
        isContainmentCheck(script) && script.includes('/out')
          ? realpathResult('/etc')
          : isContainmentCheck(script)
            ? realpathResult(WORKDIR)
            : { exitCode: 0, stdout: '', stderr: '' },
    });
    await expect(fs.copyFile('/a.ts', '/out/b.ts')).rejects.toThrow(/workspace root/);
    await expect(fs.moveFile('/out/a.ts', '/b.ts')).rejects.toThrow(/workspace root/);
    expect(calls).toEqual([]);
  });

  it('rejects paths that escape the workdir before calling anything', async () => {
    const { sandbox, fs, calls } = makeNativeFs({ verifySymlinks: true });
    await expect(fs.readFile('../../etc/passwd')).rejects.toThrow(/escapes workspace root/);
    await expect(fs.writeFile('/src/../../etc/x', 'x')).rejects.toThrow(/escapes workspace root/);
    await expect(fs.exists('../outside')).rejects.toThrow(/escapes workspace root/);
    expect(sandbox.calls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('reports stat paths relative to the workspace', async () => {
    const { fs } = makeNativeFs();
    expect(await fs.stat(`${WORKDIR}/src/a.ts`)).toMatchObject({ name: 'a.ts', path: '/src/a.ts', size: 5 });
  });

  it('infers a missing file MIME type and keeps one the provider supplies', async () => {
    const { native } = makeNative();
    const sandbox = Object.assign(new FakeSandbox(), { filesystem: native });
    const fs = new SandboxFilesystem({ sandbox, workdir: WORKDIR, verifySymlinks: false });
    const base = { name: 'x', path: '/x', size: 5, createdAt: new Date(0), modifiedAt: new Date(0) };

    native.stat = async () => ({ ...base, type: 'file' });
    expect((await fs.stat('/page.png')).mimeType).toBe('image/png');

    native.stat = async () => ({ ...base, type: 'file', mimeType: 'image/x-custom' });
    expect((await fs.stat('/page.png')).mimeType).toBe('image/x-custom');

    native.stat = async () => ({ ...base, type: 'directory' });
    expect((await fs.stat('/assets.png')).mimeType).toBeUndefined();
  });

  it('passes typed errors through', async () => {
    const { native } = makeNative();
    native.readFile = async () => {
      throw new FileNotFoundError('/workspace/repo/missing');
    };
    const sandbox = Object.assign(new FakeSandbox(), { filesystem: native });
    const fs = new SandboxFilesystem({ sandbox, workdir: WORKDIR });
    await expect(fs.readFile('/missing')).rejects.toBeInstanceOf(FileNotFoundError);
  });

  describe('verifySymlinks', () => {
    it('checks a path once across stat then readFile', async () => {
      const { sandbox, fs, calls } = makeNativeFs({
        verifySymlinks: true,
        responder: () => realpathResult(`${WORKDIR}/src/a.ts`),
      });
      await fs.stat('/src/a.ts');
      await fs.readFile('/src/a.ts');
      expect(sandbox.calls.filter(isContainmentCheck)).toHaveLength(1);
      expect(sandbox.calls).toHaveLength(1);
      expect(calls.map(c => c[0])).toEqual(['stat', 'readFile']);
    });

    it('rejects a symlink that leads outside the workdir without calling the native filesystem', async () => {
      const { fs, calls } = makeNativeFs({ verifySymlinks: true, responder: () => realpathResult('/etc/hostname') });
      await expect(fs.readFile('/escape-link')).rejects.toThrow(/escapes workspace root \(symlink\)/);
      expect(calls).toEqual([]);
    });

    it('does not skip shell checks by default', async () => {
      const { sandbox, fs, calls } = makeNativeFs({ responder: () => realpathResult('/etc/hostname') });
      expect(await fs.readFile('/escape-link')).toEqual(Buffer.from('hello'));
      expect(sandbox.calls).toEqual([]);
      expect(calls).toHaveLength(1);
    });

    it('rechecks a path that was missing when first checked', async () => {
      let created = false;
      const { fs, calls } = makeNativeFs({
        verifySymlinks: true,
        responder: () => (created ? realpathResult('/etc/hostname') : { exitCode: 20, stdout: '', stderr: '' }),
      });
      await fs.readFile('/later');
      created = true;
      await expect(fs.readFile('/later')).rejects.toThrow(/escapes workspace root \(symlink\)/);
      expect(calls).toHaveLength(1);
    });

    it("does not let a stat check stand in for a write's parent check", async () => {
      const { sandbox, fs } = makeNativeFs({
        verifySymlinks: true,
        responder: script =>
          script.includes(`p='${WORKDIR}/src'`) ? realpathResult('/etc') : realpathResult(`${WORKDIR}/src/a.ts`),
      });
      await fs.stat('/src/a.ts');
      await expect(fs.writeFile('/src/a.ts', 'x')).rejects.toThrow(/escapes workspace root \(symlink\)/);
      expect(sandbox.calls.filter(isContainmentCheck)).toHaveLength(3);
    });

    it('checks the parent for deleteFile and rmdir, like the shell path', async () => {
      const { sandbox, fs } = makeNativeFs({ verifySymlinks: true });
      await fs.deleteFile('/src/a.ts');
      await fs.rmdir('/src/dir');
      expect(sandbox.calls.filter(isContainmentCheck).map(c => c.split('\n')[0])).toEqual([
        `p='${WORKDIR}/src'`,
        `p='${WORKDIR}/src'`,
      ]);
    });

    it('leaves exists unchecked', async () => {
      const { sandbox, fs } = makeNativeFs({ verifySymlinks: true });
      await fs.exists('/src/a.ts');
      expect(sandbox.calls).toEqual([]);
    });
  });
});
