import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';

import { CommandsApiProcessManager } from './commands-api-process-manager';
import type { CommandsApi, CommandsApiHandle, CommandsApiOperation } from './commands-api-process-manager';

/** Shaped like the E2B SDK's CommandExitError. */
class CommandExitError extends Error {
  constructor(
    readonly exitCode: number,
    readonly stdout: string,
    readonly stderr: string,
  ) {
    super(`exit status ${exitCode}`);
  }
}

type Listener = { onStdout?: (data: string) => void; onStderr?: (data: string) => void };

/**
 * A commands API over real host processes, answering the way envd does: a
 * background run streams output to callbacks, `wait` rejects on a non-zero
 * exit, `list` reports only running commands and `connect` attaches to one.
 */
class HostCommands implements CommandsApi {
  readonly children = new Map<
    number,
    { child: ChildProcess; cmd: string; listeners: Listener[]; done: Promise<number> }
  >();
  readonly calls: string[] = [];
  readonly connectTimeouts: Array<number | undefined> = [];
  /**
   * Hold `run`/`connect` back until the first output has been delivered, the
   * way the SDK does when output arrives with the start event: its handle
   * reads events from construction, before `run()` returns.
   */
  outputBeforeStart: false | 'stdout' | 'both' = false;

  async run(command: string, opts: Listener & { stdin?: boolean; cwd?: string; envs?: Record<string, string> }) {
    this.calls.push('run');
    const child = spawn('sh', ['-c', command], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.envs },
      stdio: [opts.stdin === false ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    const listeners: Listener[] = [opts];
    let stdout = '';
    let stderr = '';
    child.stdout!.on('data', (chunk: Buffer) => {
      stdout += chunk;
      for (const l of listeners) l.onStdout?.(chunk.toString());
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk;
      for (const l of listeners) l.onStderr?.(chunk.toString());
    });
    const done = new Promise<number>(resolve =>
      child.on('close', (code, signal) => resolve(code ?? (signal ? 137 : 1))),
    );
    this.children.set(child.pid!, { child, cmd: command, listeners, done });
    if (this.outputBeforeStart) await this.firstOutput(child, this.outputBeforeStart);
    return this.handle(child.pid!, done, () => ({ stdout, stderr }));
  }

  async connect(pid: number, opts: Listener & { timeoutMs?: number } = {}) {
    this.calls.push('connect');
    this.connectTimeouts.push(opts.timeoutMs);
    const entry = this.children.get(pid);
    if (!entry || entry.child.exitCode !== null) throw new Error(`process ${pid} not found`);
    entry.listeners.push(opts);
    if (this.outputBeforeStart) await this.firstOutput(entry.child, this.outputBeforeStart);
    return this.handle(pid, entry.done, () => ({ stdout: '', stderr: '' }));
  }

  async list() {
    this.calls.push('list');
    return [...this.children]
      .filter(([, entry]) => entry.child.exitCode === null && entry.child.signalCode === null)
      .map(([pid, entry]) => ({ pid, cmd: 'sh', args: ['-c', entry.cmd] }));
  }

  async kill(pid: number) {
    this.calls.push('kill');
    return this.children.get(pid)?.child.kill('SIGKILL') ?? false;
  }

  async sendStdin(pid: number, data: string) {
    this.calls.push('sendStdin');
    this.children.get(pid)!.child.stdin!.write(data);
  }

  private firstOutput(child: ChildProcess, streams: 'stdout' | 'both'): Promise<void> {
    return new Promise(resolve => {
      let remaining = streams === 'both' ? 2 : 1;
      // Registered after the streaming listeners, so they have run by now.
      const arrived = () => {
        if (--remaining === 0) resolve();
      };
      child.stdout!.once('data', arrived);
      if (streams === 'both') child.stderr!.once('data', arrived);
    });
  }

  private handle(pid: number, done: Promise<number>, output: () => { stdout: string; stderr: string }) {
    let exitCode: number | undefined;
    void done.then(code => (exitCode = code));
    return {
      pid,
      get exitCode() {
        return exitCode;
      },
      async wait() {
        const code = await done;
        if (code !== 0) throw new CommandExitError(code, output().stdout, output().stderr);
        return { exitCode: code };
      },
    } satisfies CommandsApiHandle;
  }

  stopAll() {
    for (const { child } of this.children.values()) child.kill('SIGKILL');
  }
}

class HostProcessManager extends CommandsApiProcessManager {
  readonly operations: CommandsApiOperation[] = [];

  constructor(readonly commands: HostCommands) {
    super({ defaultTimeout: 5_000 });
  }

  runCommands<T>(operation: CommandsApiOperation, fn: (commands: CommandsApi) => Promise<T>): Promise<T> {
    this.operations.push(operation);
    return fn(this.commands);
  }
}

class TestSandbox extends MastraSandbox {
  readonly id = 'commands-api-test';
  readonly name = 'TestSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor(processes: HostProcessManager) {
    super({ name: 'TestSandbox', processes });
  }

  async start(): Promise<void> {}
}

let commands: HostCommands;

function setup() {
  commands = new HostCommands();
  const processes = new HostProcessManager(commands);
  new TestSandbox(processes);
  return processes;
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 10));
  expect(check()).toBe(true);
};

afterEach(() => commands?.stopAll());

describe('CommandsApiProcessManager', () => {
  it('streams output while the process is still running', async () => {
    const processes = setup();
    const handle = await processes.spawn('echo first; sleep 5; echo second');

    await until(() => handle.stdout === 'first\n');
    expect(handle.exitCode).toBeUndefined();
    await handle.kill();
  });

  it('maps a non-zero exit, keeping output that arrived only on the error', async () => {
    const processes = setup();
    const handle = await processes.spawn('echo out; echo err >&2; exit 3');

    const result = await handle.wait();
    expect(result).toMatchObject({ success: false, exitCode: 3, stdout: 'out\n' });
    expect(result.stderr).toContain('err\n');
    expect(handle.exitCode).toBe(3);
    expect(await processes.spawn('true').then(h => h.wait())).toMatchObject({ success: true, exitCode: 0 });
  });

  it('kills a running process through runCommands, and not one that has exited', async () => {
    const processes = setup();
    const handle = await processes.spawn('sleep 30');

    expect(await handle.kill()).toBe(true);
    expect((await handle.wait()).exitCode).toBe(137);
    expect(processes.operations).toContain('kill');

    const kills = commands.calls.filter(call => call === 'kill').length;
    expect(await handle.kill()).toBe(false);
    expect(commands.calls.filter(call => call === 'kill')).toHaveLength(kills);
  });

  it('writes stdin through runCommands, and refuses when stdin was detached', async () => {
    const processes = setup();
    const cat = await processes.spawn('cat');
    await cat.sendStdin('hello\n');
    await until(() => cat.stdout === 'hello\n');
    expect(processes.operations).toContain('sendStdin');

    const detached = await processes.spawn('sleep 30', { stdinMode: 'ignore' });
    await expect(detached.sendStdin('x')).rejects.toThrow('not started with stdin support');
  });

  it('attaches to a process it did not start, from then on', async () => {
    const processes = setup();
    const other = await commands.run('echo before; sleep 0.3; echo after; sleep 30', {});

    await new Promise(resolve => setTimeout(resolve, 100));
    const attached = await processes.get(String(other.pid));
    expect(attached?.pid).toBe(String(other.pid));
    await until(() => attached?.stdout === 'after\n');
    expect(commands.connectTimeouts).toEqual([0]);

    expect(await processes.get('not-a-pid')).toBeUndefined();
    expect(await processes.get('999999')).toBeUndefined();
  });

  it('keeps output that arrives before the start resolves', async () => {
    const processes = setup();
    commands.outputBeforeStart = 'both';
    const handle = await processes.spawn('echo early; echo warn >&2; sleep 0.2; echo late');
    const result = await handle.wait();
    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(result.stdout).toBe('early\nlate\n');
    expect(result.stderr).toBe('warn\n');
  });

  it('keeps output that arrives before an attach resolves', async () => {
    const processes = setup();
    const other = await commands.run('sleep 0.2; echo attached; sleep 0.2', {});
    commands.outputBeforeStart = 'stdout';
    const handle = await processes.get(String(other.pid));
    expect(handle).toBeDefined();
    await handle!.wait();
    expect(handle!.stdout).toBe('attached\n');
  });

  it('lists exited processes it still holds until they are released', async () => {
    const processes = setup();
    const running = await processes.spawn('sleep 30');
    const finished = await processes.spawn('echo done');
    await finished.wait();

    const listed = await processes.list();
    expect(listed).toEqual(
      expect.arrayContaining([
        { pid: running.pid, command: 'sh -c sleep 30', running: true },
        { pid: finished.pid, command: 'echo done', running: false, exitCode: 0 },
      ]),
    );
    expect(listed).toHaveLength(2);

    await processes.get(finished.pid, { release: false });
    expect((await processes.list()).map(info => info.pid)).toContain(finished.pid);

    await processes.get(finished.pid);
    expect((await processes.list()).map(info => info.pid)).toEqual([running.pid]);
  });
});
