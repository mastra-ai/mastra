import { FileNotFoundError, IsDirectoryError } from '@mastra/core/workspace';
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

/**
 * The STANDALONE realpath containment guard (write paths, move/copy sources)
 * assigns the target path and prints root + realpath. Read ops fold their
 * containment into the same script as the operation (identified by the
 * `case "$rp"` comparison), so they no longer match here.
 */
function isContainmentCheck(script: string): boolean {
  return script.startsWith('p=') && script.includes(`printf '%s\\n%s'`);
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
    const { sandbox, fs } = makeFs(() => ({ exitCode: 0, stdout: b64, stderr: '' }));

    const result = await fs.readFile('/src/index.ts', { encoding: 'utf8' });

    expect(result).toBe(content);
    expect(sandbox.calls.some(c => c.includes(`base64 < '${WORKDIR}/src/index.ts'`))).toBe(true);
  });

  // Read-op containment is folded into the op's own script: the shell exits
  // with a sentinel code (escape / cannot-canonicalize) BEFORE the read runs.
  const CONTAINMENT_ESCAPE = { exitCode: 23, stdout: '', stderr: '' };
  const CANNOT_CANONICALIZE = { exitCode: 24, stdout: '', stderr: '' };

  it('rejects a symlink whose realpath escapes the workspace root', async () => {
    const { fs, sandbox } = makeFs(() => CONTAINMENT_ESCAPE);

    await expect(fs.readFile('/link')).rejects.toThrow(/escapes workspace root \(symlink\)/);
    // The containment comparison runs inside the same script, before the read.
    const script = sandbox.calls[0]!;
    expect(script.indexOf('case "$rp"')).toBeGreaterThanOrEqual(0);
    expect(script.indexOf('case "$rp"')).toBeLessThan(script.indexOf('base64 <'));
  });

  it('escaping symlinks are rejected by every read op', async () => {
    const { fs } = makeFs(() => CONTAINMENT_ESCAPE);
    await expect(fs.stat('/link')).rejects.toThrow(/escapes workspace root \(symlink\)/);
    await expect(fs.readdir('/link')).rejects.toThrow(/escapes workspace root \(symlink\)/);
    await expect(fs.readdir('/link', { recursive: true })).rejects.toThrow(/escapes workspace root \(symlink\)/);
  });

  it('fails closed when an existing path cannot be canonicalized', async () => {
    // If no canonicalization tool works, skipping the check would let a
    // symlink bypass containment — the operation must fail instead.
    const { fs } = makeFs(() => CANNOT_CANONICALIZE);

    await expect(fs.readFile('/link')).rejects.toThrow(/Unable to verify path stays within workspace root/);
    await expect(fs.stat('/link')).rejects.toThrow(/Unable to verify path stays within workspace root/);
    await expect(fs.readdir('/link')).rejects.toThrow(/Unable to verify path stays within workspace root/);
  });

  it('preserves per-op error types with the folded scripts', async () => {
    // readFile: missing -> FileNotFoundError, directory -> IsDirectoryError
    const { fs: missingFs } = makeFs(() => ({ exitCode: 20, stdout: '', stderr: '' }));
    await expect(missingFs.readFile('/gone.txt')).rejects.toBeInstanceOf(FileNotFoundError);

    const { fs: dirFs } = makeFs(() => ({ exitCode: 21, stdout: '', stderr: '' }));
    await expect(dirFs.readFile('/some-dir')).rejects.toBeInstanceOf(IsDirectoryError);

    // stat: missing -> FileNotFoundError (stat itself exits 1)
    const { fs: statFs } = makeFs(() => ({ exitCode: 1, stdout: '', stderr: '' }));
    await expect(statFs.stat('/gone.txt')).rejects.toBeInstanceOf(FileNotFoundError);

    // readdir: missing -> plain Error('Directory not found: <path>'), NOT FileNotFoundError
    const { fs: dirlessFs } = makeFs(() => ({ exitCode: 1, stdout: '', stderr: '' }));
    const readdirError = await dirlessFs.readdir('/gone').catch((e: unknown) => e);
    expect(readdirError).toBeInstanceOf(Error);
    expect(readdirError).not.toBeInstanceOf(FileNotFoundError);
    expect((readdirError as Error).message).toBe('Directory not found: /gone');
  });

  it('issues exactly one exec per read op on the happy path', async () => {
    const b64 = Buffer.from('x', 'utf8').toString('base64');
    const { sandbox, fs } = makeFs(script => {
      if (script.includes('stat -c')) return { exitCode: 0, stdout: 'regular file|1|1700000000|-1\n', stderr: '' };
      if (script.includes('base64 <')) return { exitCode: 0, stdout: b64, stderr: '' };
      return { exitCode: 0, stdout: 'f\ta.txt\n', stderr: '' };
    });

    await fs.stat('/a.txt');
    expect(sandbox.calls.length).toBe(1);

    sandbox.calls.length = 0;
    await fs.readFile('/a.txt');
    expect(sandbox.calls.length).toBe(1);

    sandbox.calls.length = 0;
    await fs.readdir('/');
    expect(sandbox.calls.length).toBe(1);
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
    const { sandbox, fs } = makeFs(() => ({ exitCode: 0, stdout: 'd\tsrc\nf\tREADME.md\n', stderr: '' }));

    const entries = await fs.readdir('/');

    expect(entries).toEqual([
      { name: 'src', type: 'directory' },
      { name: 'README.md', type: 'file' },
    ]);
    expect(sandbox.calls.some(c => c.includes(`cd '${WORKDIR}'`))).toBe(true);
  });

  it('stats a file and returns parsed metadata', async () => {
    const { fs } = makeFs(() => ({ exitCode: 0, stdout: 'regular file|42|1700000000|-1\n', stderr: '' }));

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
    const { sandbox, fs } = makeFs(() => ({ exitCode: 0, stdout: '', stderr: '' }));

    await fs.readFile(`${WORKDIR}/src/../notes.txt`);
    expect(sandbox.calls.some(c => c.includes(`base64 < '${WORKDIR}/notes.txt'`))).toBe(true);
  });

  it('falls back to BSD stat when GNU stat is unavailable', async () => {
    const { fs } = makeFs(script => {
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
    const { sandbox, fs } = makeFs(() => ({
      exitCode: 0,
      stdout: `d\t${WORKDIR}/src\nf\t${WORKDIR}/src/index.ts\n`,
      stderr: '',
    }));

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
