import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { execa, existsSync } = vi.hoisted(() => ({ execa: vi.fn(), existsSync: vi.fn((_path: string) => false) }));
vi.mock('./execa', () => ({ getExeca: async () => execa }));
vi.mock('node:fs', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: (p: string) => existsSync(p),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
  execa.mockReset();
  existsSync.mockReset();
  existsSync.mockReturnValue(false);
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
  ])('falls back to cmd.exe when no POSIX shell is found: %s', async originalInvocation => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
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
  ])('passes the script untouched: %s', async script => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
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

// https://github.com/mastra-ai/mastra/issues/28866
describe('LocalProcessManager Windows POSIX shell for argv commands', () => {
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';

  const setup = async (existing: string[]) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    vi.stubEnv('PATH', '');
    vi.stubEnv('ProgramFiles', 'C:\\Program Files');
    vi.stubEnv('MASTRA_WINDOWS_SHELL', '');
    existsSync.mockImplementation((p: string) => existing.includes(p));
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
    return sandbox;
  };

  it('runs POSIX-quoted argv commands through Git Bash instead of cmd.exe', async () => {
    const sandbox = await setup([gitBash]);

    await sandbox.executeCommand!('mkdir', ['-p', 'C:\\Users\\First Last\\repo']);

    expect(execa).toHaveBeenCalledWith(
      "mkdir -p 'C:\\Users\\First Last\\repo'",
      [],
      expect.objectContaining({ shell: gitBash, windowsHide: true }),
    );
  });

  it('finds Git Bash next to git.exe on PATH (Git\\cmd install layout)', async () => {
    const sandbox = await setup(['D:\\Tools\\Git\\cmd\\git.exe', 'D:\\Tools\\Git\\bin\\bash.exe', gitBash]);
    vi.stubEnv('PATH', 'C:\\Windows\\System32;D:\\Tools\\Git\\cmd');

    await sandbox.executeCommand!('git', ['clone', '--', 'https://x/y.git', 'C:\\x\\repo']);

    expect(execa.mock.calls[0]?.[2]).toMatchObject({ shell: 'D:\\Tools\\Git\\bin\\bash.exe' });
  });

  it('searches the PATH the command runs with', async () => {
    const sandbox = await setup(['D:\\Tools\\Git\\cmd\\git.exe', 'D:\\Tools\\Git\\bin\\bash.exe']);

    await sandbox.executeCommand!('git', ['status'], { env: { PATH: 'D:\\Tools\\Git\\cmd' } });

    expect(execa.mock.calls[0]?.[2]).toMatchObject({ shell: 'D:\\Tools\\Git\\bin\\bash.exe' });
  });

  it('runs argv commands through cmd.exe when MASTRA_WINDOWS_SHELL points at it', async () => {
    const cmd = 'C:\\Windows\\System32\\cmd.exe';
    const sandbox = await setup([cmd, gitBash]);
    vi.stubEnv('MASTRA_WINDOWS_SHELL', cmd);

    await sandbox.executeCommand!('dir', ['/b']);

    expect(execa).toHaveBeenCalledWith('dir /b', [], expect.objectContaining({ shell: cmd }));

    await sandbox.executeCommand!('sh', ['-c', 'echo ok']);

    expect(execa.mock.calls[1]?.[0]).toBe('sh');
  });

  it('prefers MASTRA_WINDOWS_SHELL', async () => {
    const sandbox = await setup(['E:\\msys64\\usr\\bin\\bash.exe', gitBash]);
    vi.stubEnv('MASTRA_WINDOWS_SHELL', 'E:\\msys64\\usr\\bin\\bash.exe');

    await sandbox.executeCommand!('find', ['C:\\x', '-mindepth', '1']);

    expect(execa.mock.calls[0]?.[2]).toMatchObject({ shell: 'E:\\msys64\\usr\\bin\\bash.exe' });
  });

  it('runs bare `sh -c` scripts with Git Bash when sh is not on PATH', async () => {
    const sandbox = await setup([gitBash]);

    await sandbox.executeCommand!('sh', ['-c', 'echo ok && echo done']);

    expect(execa).toHaveBeenCalledWith(
      gitBash,
      ['-c', 'echo ok && echo done'],
      expect.objectContaining({ shell: false }),
    );
  });

  it('keeps cmd.exe for plain string commands', async () => {
    const sandbox = await setup([gitBash]);

    await sandbox.executeCommand!('dir /b');

    expect(execa).toHaveBeenCalledWith('dir /b', [], expect.objectContaining({ shell: true }));
  });

  it('keeps cmd.exe for argv calls to Windows command interpreters', async () => {
    const sandbox = await setup([gitBash]);

    await sandbox.executeCommand!('cmd.exe', ['/c', 'echo', 'hello']);
    await sandbox.executeCommand!('powershell', ['-Command', 'Get-Date']);

    expect(execa.mock.calls[0]?.[2]).toMatchObject({ shell: true });
    expect(execa.mock.calls[1]?.[2]).toMatchObject({ shell: true });
  });

  it('turns off MSYS path conversion so /F-style switches reach native tools unchanged', async () => {
    const sandbox = await setup([gitBash]);

    await sandbox.executeCommand!('taskkill', ['/F', '/PID', '123']);
    await sandbox.executeCommand!('sh', ['-c', 'taskkill /F /PID 123']);

    for (const call of execa.mock.calls) {
      expect(call[2].env).toMatchObject({ MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' });
    }
    expect(execa.mock.calls[0]?.[2]).toMatchObject({ shell: gitBash });
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
