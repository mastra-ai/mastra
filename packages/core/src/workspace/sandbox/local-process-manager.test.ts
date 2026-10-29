import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('./execa', () => ({ getExeca: async () => execa }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  execa.mockReset();
});

// Hide any Git for Windows install on the host so the cmd.exe fallback is deterministic.
const stubNoPosixShell = () => {
  vi.stubEnv('MASTRA_WINDOWS_SHELL', '');
  vi.stubEnv('PATH', '');
  vi.stubEnv('ProgramFiles', join(tmpdir(), 'mastra-no-git-here'));
};

describe('resolveWindowsPosixShell', () => {
  const existing =
    (...files: string[]) =>
    (file: string) =>
      files.includes(file);

  it('uses MASTRA_WINDOWS_SHELL when it exists', async () => {
    const { resolveWindowsPosixShell } = await import('./local-process-manager');
    const shell = 'D:\\tools\\bash.exe';
    expect(
      resolveWindowsPosixShell(
        { MASTRA_WINDOWS_SHELL: ` ${shell} `, PATH: 'C:\\Git\\cmd' },
        existing(shell, 'C:\\Git\\cmd\\git.exe', 'C:\\Git\\bin\\bash.exe'),
      ),
    ).toBe(shell);
  });

  it('throws when MASTRA_WINDOWS_SHELL points to a missing file', async () => {
    const { resolveWindowsPosixShell } = await import('./local-process-manager');
    expect(() => resolveWindowsPosixShell({ MASTRA_WINDOWS_SHELL: 'D:\\missing\\bash.exe' }, existing())).toThrow(
      'MASTRA_WINDOWS_SHELL points to "D:\\missing\\bash.exe", which does not exist',
    );
  });

  it.each([
    ['D:\\Apps\\Git\\cmd', 'D:\\Apps\\Git\\bin\\bash.exe'],
    ['D:\\Apps\\Git\\cmd\\', 'D:\\Apps\\Git\\bin\\bash.exe'],
    ['"D:\\Apps\\Git\\bin"', 'D:\\Apps\\Git\\bin\\bash.exe'],
    ['D:\\Apps\\Git\\mingw64\\bin', 'D:\\Apps\\Git\\bin\\bash.exe'],
    ['D:\\Apps\\Git\\usr\\bin', 'D:\\Apps\\Git\\bin\\bash.exe'],
  ])('finds Git Bash from git.exe on PATH entry %s', async (gitDir, bash) => {
    const { resolveWindowsPosixShell } = await import('./local-process-manager');
    const gitExe = `${gitDir.replace(/"/g, '').replace(/\\$/, '')}\\git.exe`;
    expect(
      resolveWindowsPosixShell(
        { Path: `C:\\Windows\\System32;${gitDir}`, ProgramFiles: 'C:\\PF' },
        existing(gitExe, bash),
      ),
    ).toBe(bash);
  });

  it('falls back to Git under ProgramFiles, then to nothing', async () => {
    const { resolveWindowsPosixShell } = await import('./local-process-manager');
    expect(resolveWindowsPosixShell({ ProgramFiles: 'E:\\PF' }, existing('E:\\PF\\Git\\bin\\bash.exe'))).toBe(
      'E:\\PF\\Git\\bin\\bash.exe',
    );
    expect(resolveWindowsPosixShell({}, existing('C:\\Program Files\\Git\\bin\\bash.exe'))).toBe(
      'C:\\Program Files\\Git\\bin\\bash.exe',
    );
    expect(resolveWindowsPosixShell({ PATH: 'C:\\Windows' }, existing())).toBeUndefined();
  });
});

describe('LocalProcessManager Windows POSIX shell', () => {
  const setup = async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    const dir = mkdtempSync(join(tmpdir(), 'mastra-win-shell-'));
    const bash = join(dir, 'bash.exe');
    writeFileSync(bash, '');
    vi.stubEnv('MASTRA_WINDOWS_SHELL', bash);
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();
    execa.mockImplementation(() => {
      const subprocess = Object.assign(new EventEmitter(), {
        pid: 12345,
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        catch: vi.fn(),
      });
      queueMicrotask(() => subprocess.emit('close', 0, null));
      return subprocess;
    });
    return { sandbox, bash, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  };

  it.each([
    ['mkdir', ['-p', 'C:\\Users\\First Last\\repo'], "mkdir -p 'C:\\Users\\First Last\\repo'"],
    [
      'find',
      ['C:\\work dir', '-mindepth', '1', '-maxdepth', '1', '-exec', 'rm', '-rf', '--', '{}', '+'],
      "find 'C:\\work dir' -mindepth 1 -maxdepth 1 -exec rm -rf -- '{}' '+'",
    ],
    ['git', ['clone', '--', 'https://x/y.git', 'C:\\repo'], "git clone -- https://x/y.git 'C:\\repo'"],
    ['sh', ['-c', 'echo ok && echo done'], "sh -c 'echo ok && echo done'"],
  ])('runs executeCommand(%s, ...) through the POSIX shell, not cmd.exe', async (command, args, expected) => {
    const { sandbox, bash, cleanup } = await setup();
    try {
      const result = await sandbox.executeCommand!(command, args);
      expect(result.exitCode).toBe(0);
      expect(execa).toHaveBeenCalledWith(expected, [], expect.objectContaining({ shell: bash, windowsHide: true }));
    } finally {
      cleanup();
    }
  });

  it('runs plain string commands through the POSIX shell when MASTRA_WINDOWS_SHELL is set', async () => {
    const { sandbox, bash, cleanup } = await setup();
    try {
      await sandbox.executeCommand!('ls -la | head');
      expect(execa).toHaveBeenCalledWith('ls -la | head', [], expect.objectContaining({ shell: bash }));
    } finally {
      cleanup();
    }
  });

  it('keeps plain string commands on cmd.exe when MASTRA_WINDOWS_SHELL is unset', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('MASTRA_WINDOWS_SHELL', '');
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();
    const subprocess = Object.assign(new EventEmitter(), {
      pid: 12345,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      catch: vi.fn(),
    });
    execa.mockReturnValue(subprocess);
    const handle = await sandbox.processes.spawn('dir');
    expect(execa).toHaveBeenCalledWith('dir', [], expect.objectContaining({ shell: true }));
    subprocess.emit('close', 0, null);
    await handle.wait();
    sandbox.processes.release(handle.pid);
  });

  it('fails clearly when MASTRA_WINDOWS_SHELL points to a missing file', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('MASTRA_WINDOWS_SHELL', join(tmpdir(), 'mastra-missing-bash.exe'));
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();
    await expect(sandbox.processes.spawn('git', { originalInvocation: { command: 'git', args: [] } })).rejects.toThrow(
      'MASTRA_WINDOWS_SHELL points to',
    );
    expect(execa).not.toHaveBeenCalled();
  });
});

describe('LocalProcessManager Windows argv boundary', () => {
  it.each([
    { platform: 'linux', isolation: 'none' },
    { platform: 'win32', isolation: 'bwrap' },
  ] as const)('keeps the existing wrapper for $platform/$isolation', async ({ platform, isolation }) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platform);
    const nativeSandbox = await import('./native-sandbox');
    vi.spyOn(nativeSandbox, 'isIsolationAvailable').mockReturnValue(true);
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();
    const wrap = vi.spyOn(sandbox, 'wrapCommandForIsolation').mockReturnValue({ command: 'wrapper', args: ['script'] });
    const subprocess = Object.assign(new EventEmitter(), {
      pid: 12345,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      catch: vi.fn(),
    });
    execa.mockReturnValue(subprocess);
    const handle = await sandbox.processes.spawn('sh -c script', {
      originalInvocation: { command: 'sh', args: ['-c', 'script'] },
    });
    expect(wrap).toHaveBeenCalledWith('sh -c script');
    expect(execa).toHaveBeenCalledWith('wrapper', ['script'], expect.objectContaining({ shell: isolation === 'none' }));
    subprocess.emit('close', 0, null);
    await handle.wait();
    sandbox.processes.release(handle.pid);
  });

  it.each([
    undefined,
    { command: 'cmd.exe', args: ['/c', 'echo hello'] },
    { command: 'sh', args: ['script.sh'] },
    { command: 'sh', args: ['-c'] },
  ])('retains cmd.exe interpretation without a POSIX shell: %s', async originalInvocation => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    stubNoPosixShell();
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();
    const subprocess = Object.assign(new EventEmitter(), {
      pid: 12345,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      catch: vi.fn(),
    });
    execa.mockReturnValue(subprocess);
    const handle = await sandbox.processes.spawn('echo hello && echo world', { originalInvocation });
    expect(execa).toHaveBeenCalledWith('echo hello && echo world', [], expect.objectContaining({ shell: true }));
    subprocess.emit('close', 0, null);
    await handle.wait();
    sandbox.processes.release(handle.pid);
  });

  it.each([
    'printf "first" && printf " second"',
    'false || printf recovered',
    'printf hello | cat > output.txt',
    'printf "%s" "$1"\nprintf "%s" "a\\b"',
  ])('passes the script untouched without a POSIX shell: %s', async script => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    stubNoPosixShell();
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();
    const subprocess = Object.assign(new EventEmitter(), {
      pid: 12345,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      catch: vi.fn(),
    });
    execa.mockReturnValue(subprocess);
    const args = ['-c', script, 'sh', ''];
    const handle = await sandbox.processes.spawn('flattened command', {
      originalInvocation: { command: 'C:\\Program Files\\Git\\bin\\sh.exe', args },
      env: { TEST_ARGV: 'preserved' },
    });
    expect(execa).toHaveBeenCalledWith(
      'C:\\Program Files\\Git\\bin\\sh.exe',
      args,
      expect.objectContaining({
        shell: false,
        windowsHide: true,
        cwd: process.cwd(),
        stdio: 'pipe',
        env: expect.objectContaining({ TEST_ARGV: 'preserved' }),
      }),
    );
    expect(execa.mock.calls[0]?.[2]).not.toHaveProperty('detached');
    subprocess.emit('close', 0, null);
    expect((await handle.wait()).exitCode).toBe(0);
    sandbox.processes.release(handle.pid);
  });
});

describe('LocalProcessManager stdin wiring', () => {
  const spawnSandbox = async () => {
    const { LocalSandbox } = await import('./local-sandbox');
    const sandbox = new LocalSandbox({ workingDirectory: process.cwd(), isolation: 'none' });
    vi.spyOn(sandbox, 'ensureRunning').mockResolvedValue();

    // Mirror what execa does: a `stdio[0] === 'ignore'` child has no stdin stream.
    const subprocesses: any[] = [];
    execa.mockImplementation((_command: string, _args: string[], options: any) => {
      const stdinIgnored = Array.isArray(options?.stdio) && options.stdio[0] === 'ignore';
      const subprocess = Object.assign(new EventEmitter(), {
        pid: 12345,
        stdin: stdinIgnored ? null : new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        catch: vi.fn(),
      });
      subprocesses.push(subprocess);
      return subprocess;
    });

    return { sandbox, lastSubprocess: () => subprocesses.at(-1)! };
  };

  it('keeps stdin writable by default so spawned processes can be driven', async () => {
    const { sandbox, lastSubprocess } = await spawnSandbox();

    const handle = await sandbox.processes.spawn('node server.js');
    expect(execa.mock.calls[0]?.[2]).toMatchObject({ stdio: 'pipe' });
    await expect(handle.sendStdin('data\n')).resolves.toBeUndefined();

    lastSubprocess().emit('close', 0, null);
    await handle.wait();
    sandbox.processes.release(handle.pid);
  });

  it('closes stdin when stdinMode is ignore', async () => {
    const { sandbox, lastSubprocess } = await spawnSandbox();

    const handle = await sandbox.processes.spawn('cat', { stdinMode: 'ignore' });
    expect(execa.mock.calls[0]?.[2]).toMatchObject({ stdio: ['ignore', 'pipe', 'pipe'] });

    lastSubprocess().emit('close', 0, null);
    await handle.wait();
    sandbox.processes.release(handle.pid);
  });

  it('rejects sendStdin on a process spawned with stdin ignored', async () => {
    const { sandbox, lastSubprocess } = await spawnSandbox();

    const handle = await sandbox.processes.spawn('cat', { stdinMode: 'ignore' });
    await expect(handle.sendStdin('data')).rejects.toThrow(/stdin/i);

    lastSubprocess().emit('close', 0, null);
    await handle.wait();
    sandbox.processes.release(handle.pid);
  });
});
