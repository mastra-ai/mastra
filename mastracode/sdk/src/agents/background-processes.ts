import type { AgentControllerRequestContext, Session } from '@mastra/core/agent-controller';
import { DEFAULT_TAIL_LINES, WORKSPACE_TOOLS, truncateOutput } from '@mastra/core/workspace';
import type {
  BackgroundProcessExitMeta,
  ProcessHandle,
  WorkspaceSandbox,
  WorkspaceToolAfterHookContext,
  WorkspaceToolHookContext,
} from '@mastra/core/workspace';
import { MC_TOOLS } from '../tool-names.js';
import type { BackgroundCompletionEvents } from './background-completion-events.js';
import type { BackgroundNoticeDelivery, BackgroundNoticeTarget } from './background-completion.js';

const SANDBOX_TEARDOWN_STATUSES = new Set(['stopping', 'stopped', 'destroying', 'destroyed']);
const BACKGROUND_PROCESS_RESULT = /^Started background process \(PID: ([^)]+)\)/;

interface Launch {
  command?: string;
  description?: string;
  sandbox?: WorkspaceSandbox;
  /** The parent thread, for shells started by subagents. Wins over the thread in the exit metadata. */
  parentTarget?: BackgroundNoticeTarget;
}

interface ToolContextLike {
  agent?: { toolCallId?: string; threadId?: string };
  workspace?: { sandbox?: WorkspaceSandbox };
  requestContext?: { get?: (key: string) => unknown };
}

export interface BackgroundProcessNotices {
  /** Workspace `beforeToolCall` hook: records launches and marks `kill_process` targets. */
  beforeToolCall(context: WorkspaceToolHookContext): Promise<void>;
  /** Workspace `afterToolCall` hook: drops state for launches and kills that did not happen. */
  afterToolCall(context: WorkspaceToolAfterHookContext): void;
  /** `execute_command` `backgroundProcesses.onExit` callback. */
  onExit(meta: BackgroundProcessExitMeta): Promise<void>;
  /**
   * Reads a running background process's output without releasing it, so the
   * agent can still read it with `get_process_output`. Undefined once the
   * process has exited.
   */
  read(pid: string): Promise<ProcessHandle | undefined>;
  /** Kills a background process for the user, without posting an exit notice. False when it was not running. */
  kill(pid: string): Promise<boolean>;
}

/** What `createMastraCode()` hands to hosts: reading and killing background shells. */
export type BackgroundProcessControls = Pick<BackgroundProcessNotices, 'read' | 'kill'>;

function stringInput(input: unknown, key: string): string | undefined {
  const value = (input as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function formatOutput(stdout: string, stderr: string): string {
  if (stdout && stderr) return `stdout:\n${stdout}\n\nstderr:\n${stderr}`;
  if (stderr) return `stderr:\n${stderr}`;
  return stdout;
}

/** The PID in an `execute_command` background result, such as `Started background process (PID: 4242)`. */
export function parseBackgroundProcessPid(result: unknown): string | undefined {
  return typeof result === 'string' ? result.match(BACKGROUND_PROCESS_RESULT)?.[1] : undefined;
}

/**
 * Subagents run on a thread of their own: none for a plain subagent, a cloned
 * thread for a forked one. Their shells should report to the parent thread.
 * The subagent's controller context keeps the parent run's `isThreadActive`,
 * which says whether the session is still on the parent thread. Only then is
 * the session's current thread the parent's. This is checked when the shell
 * starts, so a subagent that starts a shell after the user left the parent
 * thread gets no agent notice.
 */
async function resolveParentThread(
  context: ToolContextLike | undefined,
  getSession: (sessionId: string) => Promise<Session<any> | undefined>,
): Promise<BackgroundNoticeTarget | undefined> {
  const controller = context?.requestContext?.get?.('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.sessionId || !controller.isThreadActive) return undefined;
  const session = await getSession(controller.sessionId);
  if (!session) return undefined;
  // Read the current thread and the parent check together, after the await,
  // so a thread switch cannot fall between them.
  const currentThreadId = session.thread.getId();
  if (!currentThreadId || currentThreadId === controller.threadId || !controller.isThreadActive()) return undefined;
  return { resourceId: session.identity.getResourceId(), threadId: currentThreadId };
}

export function createBackgroundProcessNotices(options: {
  delivery: BackgroundNoticeDelivery;
  events?: BackgroundCompletionEvents;
  getSession: (sessionId: string) => Promise<Session<any> | undefined>;
}): BackgroundProcessNotices {
  const launches = new Map<string, Launch>();
  // The sandbox each PID runs in. The session's own workspace can be a different
  // instance than the one a run resolved, so read and kill where it was spawned.
  const sandboxes = new Map<string, WorkspaceSandbox>();
  // PIDs killed on purpose. `onExit` fires before `kill()` resolves, so they
  // must be marked before the kill starts.
  const killed = new Set<string>();

  return {
    async beforeToolCall({ workspaceToolName, input, context }) {
      if (workspaceToolName === WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS) {
        const pid = stringInput(input, 'pid');
        if (pid) killed.add(pid);
        return;
      }
      if (workspaceToolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) return;
      if ((input as { background?: unknown } | undefined)?.background !== true) return;
      const toolContext = context as ToolContextLike | undefined;
      const toolCallId = toolContext?.agent?.toolCallId;
      if (!toolCallId) return;
      launches.set(toolCallId, {
        command: stringInput(input, 'command'),
        description: stringInput(input, 'description'),
        sandbox: toolContext?.workspace?.sandbox,
        parentTarget: await resolveParentThread(toolContext, options.getSession).catch(() => undefined),
      });
    },

    afterToolCall({ workspaceToolName, input, context, output, error }) {
      if (workspaceToolName === WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS) {
        // A successful kill already consumed the mark in `onExit`.
        const pid = stringInput(input, 'pid');
        if (pid) killed.delete(pid);
        return;
      }
      if (workspaceToolName !== WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) return;
      const toolContext = context as ToolContextLike | undefined;
      const toolCallId = toolContext?.agent?.toolCallId;
      const pid = error === undefined ? parseBackgroundProcessPid(output) : undefined;
      // No PID means no process started (an error, or a call the hook chain answered), so no exit will come.
      if (!pid) {
        if (toolCallId) launches.delete(toolCallId);
        return;
      }
      const sandbox = toolContext?.workspace?.sandbox;
      if (sandbox) sandboxes.set(pid, sandbox);
    },

    async onExit(meta) {
      const launch = meta.toolCallId ? launches.get(meta.toolCallId) : undefined;
      if (meta.toolCallId) launches.delete(meta.toolCallId);
      sandboxes.delete(meta.pid);
      const killedOnPurpose = killed.delete(meta.pid);
      const shuttingDown = SANDBOX_TEARDOWN_STATUSES.has(String(launch?.sandbox?.status));
      const wasKilled = killedOnPurpose || meta.killedByAbort === true || shuttingDown;
      const target =
        launch?.parentTarget ??
        (meta.threadId && meta.resourceId ? { resourceId: meta.resourceId, threadId: meta.threadId } : undefined);
      const eventId = `background-process:${meta.pid}:${meta.toolCallId ?? meta.runId ?? 'exit'}`;

      try {
        if (wasKilled || !target) return;
        const [stdout, stderr] = await Promise.all([
          meta.stdout ? truncateOutput(meta.stdout, DEFAULT_TAIL_LINES, undefined, 'sandwich') : '',
          meta.stderr ? truncateOutput(meta.stderr, DEFAULT_TAIL_LINES, undefined, 'sandwich') : '',
        ]);
        const output = formatOutput(stdout, stderr);
        const command = launch?.command ?? `PID ${meta.pid}`;
        const status = meta.exitCode === 0 ? 'completed' : 'failed';
        const contents = [
          `Background command exited with code ${meta.exitCode}: ${command}`,
          output || '(no output)',
          `Full output: \`${MC_TOOLS.GET_PROCESS_OUTPUT}\` PID ${meta.pid}`,
        ].join('\n\n');

        await options.delivery.deliver(target, {
          id: eventId,
          type: 'notification',
          tagName: 'notification',
          contents,
          attributes: {
            source: 'background-work',
            kind: 'background-process-exited',
            priority: status === 'failed' ? 'high' : 'low',
            status,
          },
          metadata: {
            backgroundCompletion: {
              eventId,
              kind: 'process',
              pid: meta.pid,
              originRunId: meta.runId,
              originToolCallId: meta.toolCallId,
              toolName: MC_TOOLS.EXECUTE_COMMAND,
              status,
              exitCode: meta.exitCode,
              title: 'Shell',
              summary: launch?.description ?? command,
            },
          },
        });
      } finally {
        options.events?.publish({
          kind: 'process',
          id: eventId,
          pid: meta.pid,
          command: launch?.command,
          exitCode: meta.exitCode,
          killed: wasKilled,
          toolCallId: meta.toolCallId,
          resourceId: target?.resourceId,
          threadId: target?.threadId,
        });
      }
    },

    async read(pid) {
      const handle = await sandboxes.get(pid)?.processes?.get(pid, { release: false });
      if (handle?.exitCode !== undefined) sandboxes.delete(pid);
      return handle;
    },

    async kill(pid) {
      const sandbox = sandboxes.get(pid);
      if (!sandbox?.processes) return false;
      killed.add(pid);
      try {
        return await sandbox.processes.kill(pid);
      } finally {
        killed.delete(pid);
        sandboxes.delete(pid);
      }
    },
  };
}
