import { describe, expect, it } from 'vitest';
import { SandboxFilesystem } from './sandbox-filesystem';
import type { SandboxCommandResult, SandboxExec } from './sandbox-filesystem';

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

function makeFs(responder?: (script: string) => SandboxCommandResult) {
  const sandbox = new FakeSandbox(responder);
  const fs = new SandboxFilesystem({ sandbox, workdir: WORKDIR });
  return { sandbox, fs };
}

describe('SandboxFilesystem', () => {
  it('reads a file via base64 and decodes it', async () => {
    const content = 'hello world';
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    const { sandbox, fs } = makeFs(script => {
      // The realpath containment check runs first; resolve it inside the workdir.
      if (script.startsWith('readlink')) return { exitCode: 0, stdout: `${WORKDIR}/src/index.ts`, stderr: '' };
      return { exitCode: 0, stdout: b64, stderr: '' };
    });

    const result = await fs.readFile('/src/index.ts', { encoding: 'utf8' });

    expect(result).toBe(content);
    expect(sandbox.calls.some(c => c.includes(`base64 < '${WORKDIR}/src/index.ts'`))).toBe(true);
  });

  it('rejects a symlink whose realpath escapes the workspace root', async () => {
    const { fs } = makeFs(script => {
      if (script.startsWith('readlink')) return { exitCode: 0, stdout: '/etc/passwd', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.readFile('/link')).rejects.toThrow(/escapes workspace root \(symlink\)/);
  });

  it('rejects a write whose parent directory is a symlink escaping the workspace', async () => {
    // The leaf doesn't exist yet, but its parent `evil` resolves to /etc, so
    // readlink -f on the parent returns an out-of-root path.
    const { fs, sandbox } = makeFs(script => {
      if (script.startsWith('readlink')) return { exitCode: 0, stdout: '/etc', stderr: '' };
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    await expect(fs.writeFile('/evil/passwd', 'x')).rejects.toThrow(/escapes workspace root \(symlink\)/);
    // The write command must never have run.
    expect(sandbox.calls.some(c => c.includes('base64 -d >'))).toBe(false);
  });

  it('allows a write when the parent realpath stays inside the workspace', async () => {
    const { fs, sandbox } = makeFs(script => {
      if (script.startsWith('readlink')) return { exitCode: 0, stdout: `${WORKDIR}/src`, stderr: '' };
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
      if (script.startsWith('readlink')) return { exitCode: 0, stdout: WORKDIR, stderr: '' };
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
      if (script.startsWith('readlink')) return { exitCode: 0, stdout: `${WORKDIR}/a.txt`, stderr: '' };
      return { exitCode: 0, stdout: 'regular file\t42\t1700000000\t-1\n', stderr: '' };
    });

    const stat = await fs.stat('/a.txt');

    expect(stat.type).toBe('file');
    expect(stat.size).toBe(42);
    expect(stat.name).toBe('a.txt');
    expect(stat.path).toBe('/a.txt');
  });

  it('removes a file via rm', async () => {
    const { sandbox, fs } = makeFs();
    await fs.deleteFile('/old.txt', { force: true });
    expect(sandbox.calls[0]).toContain(`rm -f '${WORKDIR}/old.txt'`);
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
    expect(fs.id).toBe('sandbox-fs:fake-sandbox');
    expect(fs.getInfo().metadata).toMatchObject({ basePath: WORKDIR, sandboxId: 'fake-sandbox' });
  });
});
