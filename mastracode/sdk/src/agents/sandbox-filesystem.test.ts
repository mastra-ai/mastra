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
  private responder: (script: string) => SandboxCommandResult;

  constructor(responder?: (script: string) => SandboxCommandResult) {
    this.responder = responder ?? (() => ({ exitCode: 0, stdout: '', stderr: '' }));
  }

  async executeCommand(command: string, args?: string[]): Promise<SandboxCommandResult> {
    // The filesystem always shells via `sh -c <script>`.
    const script = command === 'sh' && args?.[0] === '-c' ? args[1]! : [command, ...(args ?? [])].join(' ');
    this.calls.push(script);
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
      // Simulate macOS: the `stat -c || stat -f` compound runs BSD output.
      if (script.includes('stat -c')) {
        expect(script).toContain('stat -f');
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
            `F\t${WORKDIR}/link.ts`,
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
      { name: 'link.ts', type: 'file', isSymlink: true, path: 'link.ts' },
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
    expect(findCall).toContain(`-name '.*' -prune -o`);

    await fs.walk('.', { includeHidden: true });
    const hiddenCall = sandbox.calls.filter(c => c.includes('find ')).at(-1)!;
    expect(hiddenCall).not.toContain('-prune');
  });

  it('throws when the root is not a directory', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      return { exitCode: 20, stdout: '', stderr: '' };
    });
    await expect(fs.walk('./missing')).rejects.toThrow(/Directory not found/);
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
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: '/usr/bin/rg', stderr: '' };
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
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: '/usr/bin/rg', stderr: '' };
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
      if (script.startsWith('command -v rg')) return { exitCode: 0, stdout: '/usr/bin/rg', stderr: '' };
      if (script.startsWith('rg ')) return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    await expect(fs.grep({ pattern: 'nope', path: '.', caseSensitive: true, includeHidden: false })).resolves.toEqual(
      [],
    );
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

    for (const pattern of ['\\bfoo\\b', '\\d+', 'foo(?=bar)', 'a+?']) {
      await expect(fs.grep({ pattern, path: '.', caseSensitive: true, includeHidden: false })).rejects.toMatchObject({
        code: 'EUNSUPPORTED_PATTERN',
      });
    }
  });

  it('signals fallback when context is requested without ripgrep', async () => {
    const { fs } = makeFs(script => {
      if (isContainmentCheck(script)) return realpathResult(WORKDIR);
      if (script.startsWith('command -v rg')) return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(
      fs.grep({ pattern: 'foo', path: '.', caseSensitive: true, includeHidden: false, contextLines: 2 }),
    ).rejects.toMatchObject({ code: 'EUNSUPPORTED_PATTERN' });
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
