import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('./execa', () => ({ getExeca: async () => execa }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  execa.mockReset();
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
  ])('retains cmd.exe interpretation for other invocations: %s', async originalInvocation => {
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
