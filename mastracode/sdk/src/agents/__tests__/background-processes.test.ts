import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Session } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import {
  LocalFilesystem,
  LocalSandbox,
  WORKSPACE_TOOLS,
  Workspace,
  createWorkspaceTools,
} from '@mastra/core/workspace';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundCompletionEvents } from '../background-completion-events.js';
import type { BackgroundCompletionEvent } from '../background-completion-events.js';
import type { BackgroundNoticeSignal, BackgroundNoticeTarget } from '../background-completion.js';
import { createBackgroundProcessNotices } from '../background-processes.js';
import { createMastraCodeWorkspaceTools } from '../tool-availability.js';

const node = (script: string) => `node -e "${script}"`;

describe('Mastra Code background shell exit notices', () => {
  let dir: string;
  let workspace: Workspace | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mc-bg-shell-'));
  });

  afterEach(async () => {
    await workspace?.destroy().catch(() => {});
    workspace = undefined;
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  async function setup(sessions: Record<string, Session<any>> = {}) {
    const delivered: Array<{ target: BackgroundNoticeTarget; signal: BackgroundNoticeSignal }> = [];
    const events = createBackgroundCompletionEvents();
    const exits: BackgroundCompletionEvent[] = [];
    const exited = new Map<string, () => void>();
    events.subscribe(event => {
      exits.push(event);
      if (event.kind === 'process') exited.get(event.pid)?.();
    });
    const notices = createBackgroundProcessNotices({
      delivery: {
        deliver: async (target, signal) => {
          delivered.push({ target, signal });
        },
        flush: async () => {},
      },
      events,
      getSession: async sessionId => sessions[sessionId],
    });
    workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: dir }),
      sandbox: new LocalSandbox({ workingDirectory: dir }),
      tools: createMastraCodeWorkspaceTools(true, undefined, notices),
    });
    const tools: Record<string, any> = await createWorkspaceTools(workspace);

    let calls = 0;
    const start = async (command: string, context: Record<string, unknown> = {}) => {
      const toolCallId = `call-${++calls}`;
      const output: string = await tools['execute_command'].execute(
        { description: 'Building the app', command, background: true },
        {
          workspace,
          agent: { toolCallId, threadId: 'thread-1', resourceId: 'resource-1' },
          ...context,
        },
      );
      const pid = output.match(/PID: ([^)]+)/)?.[1];
      if (!pid) throw new Error(`No PID in ${output}`);
      // A command that ends at once can exit before its call returns.
      const exit = new Promise<void>(resolve => {
        if (exits.some(event => event.kind === 'process' && event.pid === pid)) resolve();
        else exited.set(pid, resolve);
      });
      return { pid, toolCallId, exit };
    };
    return { delivered, exits, notices, tools, start };
  }

  it('wakes the thread with the exit code and the output tail when a command finishes', async () => {
    const { delivered, start } = await setup();

    const { pid, exit } = await start(node("console.log('build output line');process.exit(3)"));
    await exit;

    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.target).toEqual({ resourceId: 'resource-1', threadId: 'thread-1' });
    const contents = String(delivered[0]!.signal.contents);
    expect(contents).toContain('exited with code 3');
    expect(contents).toContain('build output line');
    expect(contents).toContain(`get_process_output\` PID ${pid}`);
    expect(delivered[0]!.signal.metadata).toMatchObject({
      backgroundCompletion: { kind: 'process', pid, exitCode: 3, title: 'Shell', summary: 'Building the app' },
    });
  });

  it('posts no notice for a process the agent kills with kill_process, but still reports the exit', async () => {
    const { delivered, exits, start, tools } = await setup();

    const { pid, toolCallId, exit } = await start(node('setInterval(() => {}, 1000)'));
    await tools['kill_process'].execute({ pid }, { workspace, agent: { toolCallId: 'kill-call' } });
    await exit;

    expect(exits).toContainEqual(expect.objectContaining({ kind: 'process', pid, toolCallId, killed: true }));
    expect(delivered).toEqual([]);
  });

  it('still reports the natural exit of a process whose kill_process failed', async () => {
    const { delivered, start, tools } = await setup();

    const { pid, exit } = await start(node('setTimeout(() => process.exit(0), 1500)'));
    const sandboxKill = vi
      .spyOn(workspace!.sandbox!.processes!, 'kill')
      .mockRejectedValueOnce(new Error('kill not permitted'));
    await expect(
      tools['kill_process'].execute({ pid }, { workspace, agent: { toolCallId: 'kill-call' } }),
    ).rejects.toThrow('kill not permitted');
    sandboxKill.mockRestore();
    await exit;

    expect(delivered).toHaveLength(1);
    expect(String(delivered[0]!.signal.contents)).toContain('exited with code 0');
  });

  it('posts no notice for a process the user kills from the activity list', async () => {
    const { delivered, exits, notices, start } = await setup();

    const { pid, exit } = await start(node("console.log('SERVER_READY'); setInterval(() => {}, 1000)"));
    await vi.waitFor(async () => expect((await notices.read(pid))?.stdout).toContain('SERVER_READY'));
    expect(await notices.kill(pid)).toBe(true);
    await exit;

    expect(exits).toContainEqual(expect.objectContaining({ pid, killed: true }));
    expect(delivered).toEqual([]);
  });

  it('posts no notice for a process a host kills through the sandbox directly', async () => {
    const { delivered, exits, start } = await setup();

    const { pid, exit } = await start(node('setInterval(() => {}, 1000)'));
    expect(await workspace!.sandbox!.processes!.kill(pid)).toBe(true);
    await exit;

    expect(exits).toContainEqual(expect.objectContaining({ pid, killed: true }));
    expect(delivered).toEqual([]);
  });

  it('keeps a background process running when the run that started it is aborted', async () => {
    const { start } = await setup();
    const run = new AbortController();

    const { pid } = await start(node('setInterval(() => {}, 1000)'), { abortSignal: run.signal });
    run.abort();
    await new Promise(resolve => setImmediate(resolve));

    const handle = await workspace!.sandbox!.processes!.get(pid, { release: false });
    expect(handle?.exitCode).toBeUndefined();
  });

  it('posts no notices for processes the sandbox kills while shutting down', async () => {
    const { delivered, exits, start } = await setup();

    const { pid, exit } = await start(node('setInterval(() => {}, 1000)'));
    await workspace!.destroy();
    await exit;

    expect(exits).toContainEqual(expect.objectContaining({ pid, killed: true }));
    expect(delivered).toEqual([]);
  });

  it('stops reaching shells once their sandbox is torn down', async () => {
    const { notices, start } = await setup();

    const { pid, exit } = await start(node('process.exit(0)'));
    await exit;
    const processes = workspace!.sandbox!.processes!;
    await workspace!.destroy();
    const get = vi.spyOn(processes, 'get');
    const kill = vi.spyOn(processes, 'kill');

    expect(await notices.read(pid)).toBeUndefined();
    expect(await notices.kill(pid)).toBe(false);
    expect(get).not.toHaveBeenCalled();
    expect(kill).not.toHaveBeenCalled();
  });

  it('keeps an exited shell readable until its output is released', async () => {
    const { notices, start, tools } = await setup();

    const { pid, exit } = await start(node("console.log('DONE_OUTPUT'); process.exit(2)"));
    await exit;

    expect(await notices.read(pid)).toMatchObject({ exitCode: 2, stdout: expect.stringContaining('DONE_OUTPUT') });
    expect(await notices.read(pid)).toMatchObject({ exitCode: 2 });
    // The agent reading it releases it, as `get_process_output` does after an exit.
    await tools['get_process_output'].execute({ pid }, { workspace, agent: { toolCallId: 'read-call' } });
    expect(await notices.read(pid)).toBeUndefined();
  });

  it('can retry a kill that failed', async () => {
    const { notices, start } = await setup();

    const { pid, exit } = await start(node('setInterval(() => {}, 1000)'));
    vi.spyOn(workspace!.sandbox!.processes!, 'kill').mockRejectedValueOnce(new Error('kill not permitted'));
    await expect(notices.kill(pid)).rejects.toThrow('kill not permitted');

    expect(await notices.kill(pid)).toBe(true);
    await exit;
  });

  // Factory shares one dispatcher across every session's sandbox, and remote sandboxes number their processes alike.
  it("keeps an agent's kill in one sandbox from silencing an exit with the same PID in another", async () => {
    const delivered: BackgroundNoticeSignal[] = [];
    const notices = createBackgroundProcessNotices({
      delivery: { deliver: async (_target, signal) => void delivered.push(signal), flush: async () => {} },
      getSession: async () => undefined,
    });
    const [killedIn, exitedIn] = [{ status: 'running' }, { status: 'running' }] as unknown as WorkspaceSandbox[];
    const hook = (workspaceToolName: string, input: unknown, sandbox: WorkspaceSandbox, toolCallId: string) =>
      notices.beforeToolCall({
        workspaceToolName,
        input,
        context: { agent: { toolCallId }, workspace: { sandbox } },
      } as any);

    await hook(WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS, { pid: '7' }, killedIn!, 'kill-call');
    await hook(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND, { command: 'pnpm dev', background: true }, exitedIn!, 'dev');
    await notices.onExit({
      pid: '7',
      toolCallId: 'dev',
      threadId: 't',
      resourceId: 'r',
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    expect(delivered).toHaveLength(1);
  });

  it('tells apart launches that reuse a tool call id on different threads', async () => {
    const delivered: BackgroundNoticeSignal[] = [];
    const notices = createBackgroundProcessNotices({
      delivery: { deliver: async (_target, signal) => void delivered.push(signal), flush: async () => {} },
      getSession: async () => undefined,
    });
    const sandbox = { status: 'running' } as unknown as WorkspaceSandbox;
    for (const threadId of ['thread-a', 'thread-b']) {
      await notices.beforeToolCall({
        workspaceToolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
        input: { command: 'pnpm dev', description: `Dev server on ${threadId}`, background: true },
        context: { agent: { toolCallId: 'call-1', threadId }, workspace: { sandbox } },
      } as any);
    }

    await notices.onExit({
      pid: '7',
      toolCallId: 'call-1',
      threadId: 'thread-a',
      resourceId: 'r',
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    expect(delivered[0]?.metadata).toMatchObject({ backgroundCompletion: { summary: 'Dev server on thread-a' } });
  });

  // A run outside an agent has its thread at the top of the tool context; the exit carries that thread too.
  it('matches the exit of a shell started from a run with its thread at the top level', async () => {
    const { delivered, start } = await setup();

    const { exit } = await start(node('process.exit(0)'), {
      agent: { toolCallId: 'top-call' },
      threadId: 'thread-top',
      resourceId: 'resource-1',
    });
    await exit;

    expect(delivered[0]?.target).toEqual({ resourceId: 'resource-1', threadId: 'thread-top' });
    expect(delivered[0]?.signal.metadata).toMatchObject({ backgroundCompletion: { summary: 'Building the app' } });
  });

  describe('which thread a shell reports to', () => {
    /**
     * The controller context of the run that starts the shell. A plain subagent
     * has no thread, a forked one has its cloned thread, and both keep the
     * parent run's `isThreadActive`.
     */
    function runContext({
      controllerThreadId,
      isThreadActive,
    }: {
      controllerThreadId: string | null;
      isThreadActive: boolean;
    }) {
      const requestContext = new RequestContext();
      requestContext.set('controller', {
        threadId: controllerThreadId,
        resourceId: controllerThreadId ? 'resource-1' : '',
        sessionId: 'session-1',
        isThreadActive: () => isThreadActive,
      });
      const agent = controllerThreadId
        ? { toolCallId: 'run-call', threadId: controllerThreadId, resourceId: 'resource-1' }
        : { toolCallId: 'sub-call' };
      return { agent, requestContext };
    }
    function sessionOn(currentThreadId: string) {
      return {
        thread: {
          getId: () => currentThreadId,
          getById: async ({ threadId }: { threadId: string }) =>
            threadId === 'fork-thread'
              ? { id: threadId, metadata: { forkedSubagent: true, parentThreadId: 'parent-thread' } }
              : { id: threadId, metadata: {} },
        },
        identity: { getResourceId: () => 'resource-1' },
      } as unknown as Session<any>;
    }
    async function reportedThreads(currentThreadId: string, context: ReturnType<typeof runContext>) {
      const { delivered, exits, start } = await setup({ 'session-1': sessionOn(currentThreadId) });
      const { pid, exit } = await start(node('process.exit(0)'), context);
      await exit;
      // Anchor: the exit itself was seen, notice or not.
      expect(exits).toContainEqual(expect.objectContaining({ pid, killed: false }));
      return delivered.map(notice => notice.target.threadId);
    }

    it.each([
      [
        'a plain subagent, parent thread active',
        'parent-thread',
        { controllerThreadId: null, isThreadActive: true },
        ['parent-thread'],
      ],
      [
        'a forked subagent, parent thread active',
        'parent-thread',
        { controllerThreadId: 'fork-thread', isThreadActive: true },
        ['parent-thread'],
      ],
      [
        'a plain subagent after the user left the parent thread',
        'other-thread',
        { controllerThreadId: null, isThreadActive: false },
        [],
      ],
      [
        'a forked subagent after the user left the parent thread',
        'other-thread',
        { controllerThreadId: 'fork-thread', isThreadActive: false },
        [],
      ],
      ['the parent agent itself', 'thread-1', { controllerThreadId: 'thread-1', isThreadActive: true }, ['thread-1']],
      [
        'the parent agent after the user switched threads',
        'other-thread',
        { controllerThreadId: 'thread-1', isThreadActive: false },
        ['thread-1'],
      ],
    ] as const)('%s', async (_case, currentThreadId, run, expected) => {
      expect(await reportedThreads(currentThreadId, runContext(run))).toEqual(expected);
    });
  });
});
