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
  /** Thread to notify when the exit metadata has none (shells started by subagents). */
  fallbackTarget?: BackgroundNoticeTarget;
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
   * Reads a background process's current output without releasing it, so the
   * agent can still read it with `get_process_output`.
   */
  read(pid: string): Promise<ProcessHandle | undefined>;
  /** Kills a background process for the user, without posting an exit notice. */
  kill(pid: string): Promise<boolean>;
}

function stringInput(input: unknown, key: string): string | undefined {
  const value = (input as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function formatOutput(stdout: string, stderr: string): string {
  if (stdout && stderr) return `stdout:\n${stdout}\n\nstderr:\n${stderr}`;
  if (stderr) return `stderr:\n${stderr}`;
  return stdout;
}

/**
 * A subagent's request context has no thread, so its shells exit with no
 * thread to notify. Its controller context still answers whether the parent
 * thread is the session's current one; only then is that thread the parent's.
 */
async function resolveParentThread(
  context: ToolContextLike | undefined,
  getSession: (sessionId: string) => Promise<Session<any> | undefined>,
): Promise<BackgroundNoticeTarget | undefined> {
  const controller = context?.requestContext?.get?.('controller') as AgentControllerRequestContext | undefined;
  if (!controller || controller.threadId || !controller.sessionId || controller.isThreadActive?.() !== true) {
    return undefined;
  }
  const session = await getSession(controller.sessionId);
  const threadId = session?.thread.getId();
  return session && threadId ? { resourceId: session.identity.getResourceId(), threadId } : undefined;
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
        fallbackTarget: toolContext?.agent?.threadId
          ? undefined
          : await resolveParentThread(toolContext, options.getSession).catch(() => undefined),
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
      if (error !== undefined) {
        if (toolCallId) launches.delete(toolCallId);
        return;
      }
      const pid = typeof output === 'string' ? output.match(BACKGROUND_PROCESS_RESULT)?.[1] : undefined;
      const sandbox = toolContext?.workspace?.sandbox;
      if (pid && sandbox) sandboxes.set(pid, sandbox);
    },

    async onExit(meta) {
      const launch = meta.toolCallId ? launches.get(meta.toolCallId) : undefined;
      if (meta.toolCallId) launches.delete(meta.toolCallId);
      const killedOnPurpose = killed.delete(meta.pid);
      const shuttingDown = SANDBOX_TEARDOWN_STATUSES.has(String(launch?.sandbox?.status));
      const wasKilled = killedOnPurpose || meta.killedByAbort === true || shuttingDown;
      const target =
        meta.threadId && meta.resourceId
          ? { resourceId: meta.resourceId, threadId: meta.threadId }
          : launch?.fallbackTarget;
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
      return sandboxes.get(pid)?.processes?.get(pid, { release: false });
    },

    async kill(pid) {
      const sandbox = sandboxes.get(pid);
      if (!sandbox?.processes) return false;
      killed.add(pid);
      try {
        return await sandbox.processes.kill(pid);
      } finally {
        killed.delete(pid);
      }
    },
  };
}
