import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Session } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, LocalSandbox, Workspace, createWorkspaceTools } from '@mastra/core/workspace';
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
      const exit = new Promise<void>(resolve => exited.set(pid, resolve));
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

  it('posts no notice for a process the user kills from the activity list', async () => {
    const { delivered, exits, notices, start } = await setup();

    const { pid, exit } = await start(node("console.log('SERVER_READY'); setInterval(() => {}, 1000)"));
    await vi.waitFor(async () => expect((await notices.read(pid))?.stdout).toContain('SERVER_READY'));
    expect(await notices.kill(pid)).toBe(true);
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

  describe('shells started by a subagent', () => {
    function subagentContext(isParentThreadActive: boolean) {
      const requestContext = new RequestContext();
      // A non-forked subagent's controller context has no thread of its own.
      requestContext.set('controller', {
        threadId: null,
        resourceId: '',
        sessionId: 'session-1',
        isThreadActive: () => isParentThreadActive,
      });
      return { agent: { toolCallId: 'sub-call' }, requestContext };
    }
    const session = {
      thread: { getId: () => 'parent-thread' },
      identity: { getResourceId: () => 'resource-1' },
    } as unknown as Session<any>;

    it('notify the parent thread', async () => {
      const { delivered, start } = await setup({ 'session-1': session });

      const { exit } = await start(node('process.exit(0)'), subagentContext(true));
      await exit;

      expect(delivered.map(notice => notice.target)).toEqual([{ resourceId: 'resource-1', threadId: 'parent-thread' }]);
    });

    it('notify nobody when the session already left the parent thread', async () => {
      const { delivered, exits, start } = await setup({ 'session-1': session });

      const { pid, exit } = await start(node('process.exit(0)'), subagentContext(false));
      await exit;

      expect(exits).toContainEqual(expect.objectContaining({ pid, killed: false }));
      expect(delivered).toEqual([]);
    });
  });
});
