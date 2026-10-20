import { CommandsApiProcessManager } from '@internal/workspace';
import type { CommandsApi, CommandsApiOperation, CommandsApiStreamOptions } from '@internal/workspace';
import { MastraSandbox } from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __clearSessionSandboxesForTests, getSessionSandbox } from '../sandbox/session-sandbox.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { buildProcessRoutes, MAX_PROCESS_OUTPUT_BYTES } from './processes.js';

afterEach(() => __clearSessionSandboxesForTests());

/** Shaped like the E2B SDK's CommandExitError. */
class CommandExitError extends Error {
  constructor(readonly exitCode: number) {
    super(`exit status ${exitCode}`);
  }
}

type Proc = {
  cmd: string;
  listeners: CommandsApiStreamOptions[];
  exitCode?: number;
  exited: () => void;
  done: Promise<void>;
};

/** An envd commands API whose processes the test drives: write output, exit, or get killed. */
class FakeCommands implements CommandsApi {
  readonly procs = new Map<number, Proc>();
  private nextPid = 100;

  start(cmd: string, listener: CommandsApiStreamOptions = {}) {
    const pid = this.nextPid++;
    let exited!: () => void;
    const done = new Promise<void>(resolve => (exited = resolve));
    this.procs.set(pid, { cmd, listeners: [listener], exited, done });
    return pid;
  }

  write(pid: number, stream: 'stdout' | 'stderr', data: string) {
    for (const l of this.procs.get(pid)!.listeners) (stream === 'stdout' ? l.onStdout : l.onStderr)?.(data);
  }

  exit(pid: number, code: number) {
    const proc = this.procs.get(pid)!;
    proc.exitCode = code;
    proc.exited();
  }

  private handle(pid: number) {
    const proc = this.procs.get(pid)!;
    return {
      pid,
      get exitCode() {
        return proc.exitCode;
      },
      async wait() {
        await proc.done;
        if (proc.exitCode !== 0) throw new CommandExitError(proc.exitCode!);
        return { exitCode: 0 };
      },
    };
  }

  async run(cmd: string, opts: CommandsApiStreamOptions) {
    return this.handle(this.start(cmd, opts));
  }
  async connect(pid: number, opts: CommandsApiStreamOptions = {}) {
    const proc = this.procs.get(pid);
    if (!proc || proc.exitCode !== undefined) throw new Error(`process ${pid} not found`);
    proc.listeners.push(opts);
    return this.handle(pid);
  }
  async list() {
    return [...this.procs]
      .filter(([, proc]) => proc.exitCode === undefined)
      .map(([pid, proc]) => ({ pid, cmd: '/bin/bash', args: ['-l', '-c', proc.cmd] }));
  }
  async kill(pid: number) {
    const proc = this.procs.get(pid);
    if (!proc || proc.exitCode !== undefined) return false;
    this.exit(pid, -1);
    return true;
  }
  async sendStdin() {}
}

class FakeProcessManager extends CommandsApiProcessManager {
  constructor(readonly commands: FakeCommands) {
    super();
  }
  runCommands<T>(_operation: CommandsApiOperation, fn: (commands: CommandsApi) => Promise<T>): Promise<T> {
    return fn(this.commands);
  }
}

class FakeSandbox extends MastraSandbox {
  readonly id = 'sbx-1';
  readonly name = 'FakeSandbox';
  readonly provider = 'local';
  status: ProviderStatus = 'running';
  readonly start = vi.fn(async () => {});

  constructor(processes?: FakeProcessManager) {
    super({ name: 'FakeSandbox', ...(processes && { processes }) });
  }

  get workingDirectory() {
    return '/workspaces/acme';
  }
}

function makeSession(): SourceControlSession {
  return {
    id: 'row-1',
    sessionId: 'session-1',
    projectRepositoryId: 'pr-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'main',
    title: null,
    baseBranch: 'main',
    sandboxId: 'sbx-1',
    sandboxWorkdir: '/workspaces/acme/repo',
    materializedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function seed({ processes = true }: { processes?: boolean } = {}) {
  const commands = new FakeCommands();
  const manager = processes ? new FakeProcessManager(commands) : undefined;
  const sandbox = new FakeSandbox(manager);
  getSessionSandbox('row-1', 'acme/repo', () => sandbox as never);
  return { commands, sandbox, manager: manager! };
}

function routes({ userId = 'user-1' }: { userId?: string } = {}) {
  const session = makeSession();
  const app = new Hono<any>();
  for (const route of buildProcessRoutes({
    sessionFs: {
      auth: {
        enabled: () => true,
        ensureUser: async () => undefined,
        tenant: () => ({ orgId: 'org-1', userId }),
        isOrganizationAdmin: async () => false,
      } as never,
      sessions: { getBySessionId: async (id: string) => (id === session.sessionId ? session : null) },
    },
  })) {
    if (!('handler' in route)) continue;
    const handler = (c: unknown) => route.handler(c as never, async () => {});
    if (route.method === 'POST') app.post(route.path, handler);
    else app.get(route.path, handler);
  }
  return {
    list: () => app.request('/web/workspace/processes?workspacePath=session-1'),
    read: (pid: string) => app.request(`/web/workspace/process?workspacePath=session-1&pid=${pid}`),
    kill: (pid: string) =>
      app.request('/web/workspace/process/kill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspacePath: 'session-1', pid }),
      }),
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('session process routes', () => {
  it("reports the sandbox unavailable, without starting it, when it isn't running", async () => {
    expect(await (await routes().list()).json()).toEqual({
      workspacePath: 'session-1',
      available: false,
      supported: true,
      processes: [],
    });

    const { sandbox } = seed();
    sandbox.status = 'stopped';
    expect(await (await routes().list()).json()).toMatchObject({ available: false, processes: [] });
    expect(sandbox.start).not.toHaveBeenCalled();
  });

  it('reports a sandbox with no process manager as unsupported', async () => {
    seed({ processes: false });
    expect(await (await routes().list()).json()).toEqual({
      workspacePath: 'session-1',
      available: true,
      supported: false,
      processes: [],
    });
  });

  it('lists running and exited processes, including ones it did not start', async () => {
    const { commands, manager } = seed();
    const server = await manager.spawn('pnpm dev');
    const build = await manager.spawn('pnpm build');
    const foreign = commands.start('node worker.js');
    commands.exit(Number(build.pid), 2);
    await build.wait();

    expect((await (await routes().list()).json()).processes).toEqual([
      { pid: server.pid, command: 'pnpm dev', running: true },
      { pid: String(foreign), command: 'node worker.js', running: true },
      { pid: build.pid, command: 'pnpm build', running: false, exitCode: 2 },
    ]);
  });

  it("returns a process's output, and the agent can still read it after it exits", async () => {
    const { commands, manager } = seed();
    const build = await manager.spawn('pnpm build');
    commands.write(Number(build.pid), 'stdout', 'compiling\n');
    commands.write(Number(build.pid), 'stderr', 'warning\n');

    expect(await (await routes().read(build.pid)).json()).toEqual({
      pid: build.pid,
      command: 'pnpm build',
      running: true,
      stdout: 'compiling\n',
      stderr: 'warning\n',
      stdoutTruncated: false,
      stderrTruncated: false,
      attached: false,
    });

    commands.exit(Number(build.pid), 0);
    await settle();
    expect(await (await routes().read(build.pid)).json()).toMatchObject({ running: false, exitCode: 0 });
    expect(await (await routes().read(build.pid)).json()).toMatchObject({ running: false, exitCode: 0 });

    // What the agent's get_process_output does: a default read, which releases it.
    const agentRead = await manager.get(build.pid);
    expect(agentRead?.stdout).toBe('compiling\n');
    expect(await manager.get(build.pid)).toBeUndefined();
  });

  it('returns only the end of long output, and marks it cut', async () => {
    const { commands, manager } = seed();
    const noisy = await manager.spawn('yes');
    commands.write(Number(noisy.pid), 'stdout', 'a'.repeat(10) + 'é' + 'b'.repeat(MAX_PROCESS_OUTPUT_BYTES - 1));

    const output = await (await routes().read(noisy.pid)).json();
    expect(output).toMatchObject({ stdoutTruncated: true, stderrTruncated: false });
    expect(output.stdout).toBe('b'.repeat(MAX_PROCESS_OUTPUT_BYTES - 1));
  });

  it('says when it only has output from after attaching', async () => {
    const { commands } = seed();
    const foreign = commands.start('node worker.js');

    const first = await (await routes().read(String(foreign))).json();
    commands.write(foreign, 'stdout', 'later\n');
    expect(first).toMatchObject({ attached: true, running: true });
    expect(await (await routes().read(String(foreign))).json()).toMatchObject({ stdout: 'later\n', attached: true });
  });

  it('stops a process for its owner and keeps its output readable', async () => {
    const { commands, manager } = seed();
    const server = await manager.spawn('pnpm dev');
    commands.write(Number(server.pid), 'stdout', 'listening\n');

    expect(await (await routes().kill(server.pid)).json()).toEqual({ killed: true });
    await settle();
    expect(await (await routes().read(server.pid)).json()).toMatchObject({
      running: false,
      exitCode: -1,
      stdout: 'listening\n',
    });
    expect((await manager.get(server.pid))?.stdout).toBe('listening\n');
  });

  it("refuses another user's session", async () => {
    const { manager } = seed();
    const server = await manager.spawn('pnpm dev');

    const other = routes({ userId: 'user-2' });
    expect((await other.kill(server.pid)).status).toBe(403);
    expect((await other.list()).status).toBe(403);
    expect((await other.read(server.pid)).status).toBe(403);
    expect(server.exitCode).toBeUndefined();
  });

  it('answers 404 for a pid it does not know', async () => {
    seed();
    expect((await routes().read('9999')).status).toBe(404);
    expect((await routes().kill('9999')).status).toBe(404);
  });
});
