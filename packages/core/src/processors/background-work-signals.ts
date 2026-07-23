import type { AgentSignalInput, CreatedAgentSignal } from '../agent/signals';
import type { Mastra } from '../mastra';
import { createRunScopeKey } from '../mastra/run-scope';
import type { InputProcessor } from './index';

export type BackgroundWorkDisposition = 'deferred' | 'awaited';
export type BackgroundWorkInvocationKind = 'tool' | 'agent';
export type BackgroundWorkLifecycleStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type BackgroundWorkTerminalStatus = Exclude<BackgroundWorkLifecycleStatus, 'running'>;

export interface BackgroundWorkLifecyclePayload {
  originRunId: string;
  originToolCallId: string;
  executorRunId?: string;
  taskId: string;
  invocationKind: BackgroundWorkInvocationKind;
  disposition: BackgroundWorkDisposition;
  status: BackgroundWorkLifecycleStatus;
}

type SendSignal = (signal: AgentSignalInput) => Promise<CreatedAgentSignal>;

type BackgroundWorkNotifier = {
  originRunId: string;
  originToolCallId: string;
  sendSignal: SendSignal;
  invocationKind: BackgroundWorkInvocationKind;
  disposition: BackgroundWorkDisposition;
};

const BACKGROUND_WORK_NOTIFIERS = createRunScopeKey<Map<string, BackgroundWorkNotifier>>(
  'processors.backgroundWorkNotifiers',
);
type ExecutableTool = object & {
  execute?: (inputData: unknown, context?: BackgroundWorkExecutionContext) => Promise<unknown> | unknown;
};
const BACKGROUND_WORK_WRAPPERS = createRunScopeKey<WeakMap<object, { tool: ExecutableTool; binding: ToolBinding }>>(
  'processors.backgroundWorkWrappers',
);

export const BACKGROUND_WORK_CONTEXT = Symbol('mastra.backgroundWorkContext');

export interface BackgroundWorkContext {
  originRunId: string;
  originToolCallId: string;
  taskId: string;
  invocationKind: BackgroundWorkInvocationKind;
  disposition: BackgroundWorkDisposition;
}

type BackgroundWorkExecutionContext = {
  mastra?: Mastra;
  toolCallId?: string;
  [BACKGROUND_WORK_CONTEXT]?: BackgroundWorkContext;
};

async function registerBackgroundWorkNotifier(
  context: BackgroundWorkExecutionContext,
  sendSignal: SendSignal,
): Promise<void> {
  const work = context[BACKGROUND_WORK_CONTEXT];
  if (!work || context.toolCallId !== work.originToolCallId) {
    return;
  }

  const scope = context.mastra?.__getRunScope(work.originRunId);
  if (!scope) {
    return;
  }

  let notifiers = scope.get(BACKGROUND_WORK_NOTIFIERS);
  if (!notifiers) {
    notifiers = new Map();
    scope.set(BACKGROUND_WORK_NOTIFIERS, notifiers);
  }

  if (notifiers.has(work.originToolCallId)) {
    return;
  }

  notifiers.set(work.originToolCallId, {
    originRunId: work.originRunId,
    originToolCallId: work.originToolCallId,
    sendSignal,
    invocationKind: work.invocationKind,
    disposition: work.disposition,
  });

  const event = work.disposition === 'awaited' ? 'work-awaited' : 'work-deferred';
  try {
    await sendSignal({
      type: 'notification',
      tagName: event,
      contents: `${event}: ${work.originToolCallId}`,
      metadata: {
        ...work,
        status: 'running',
      } satisfies BackgroundWorkLifecyclePayload,
    });
  } catch {
    // Dispatch already succeeded. Initial caller notification is best-effort.
  }
}

export async function notifyBackgroundWorkTerminal(
  mastra: Mastra | undefined,
  payload: BackgroundWorkLifecyclePayload,
): Promise<void> {
  const scope = mastra?.__getRunScope(payload.originRunId);
  const notifiers = scope?.get(BACKGROUND_WORK_NOTIFIERS);
  const notifier = notifiers?.get(payload.originToolCallId);

  if (
    !notifier ||
    notifier.originRunId !== payload.originRunId ||
    notifier.originToolCallId !== payload.originToolCallId ||
    notifier.invocationKind !== payload.invocationKind ||
    notifier.disposition !== payload.disposition
  ) {
    return;
  }

  // Claim the sole terminal attempt before crossing the async signal boundary.
  notifiers!.delete(payload.originToolCallId);
  if (notifiers!.size === 0) {
    scope!.delete(BACKGROUND_WORK_NOTIFIERS);
  }

  const event = payload.status === 'completed' ? 'work-completed' : 'work-failed';
  try {
    await notifier.sendSignal({
      type: 'notification',
      tagName: event,
      contents: `${event}: ${payload.originToolCallId}`,
      metadata: { ...payload },
    });
  } catch {
    // Authoritative result reconciliation and continuation already completed.
    // Caller notification is best-effort and is never retried.
  }
}

type ToolBinding = {
  sendSignal: SendSignal;
};

function wrapTool<TTool extends ExecutableTool>(tool: TTool, binding: ToolBinding): TTool {
  const wrapped = Object.create(Object.getPrototypeOf(tool));
  Object.defineProperties(wrapped, Object.getOwnPropertyDescriptors(tool));
  Object.defineProperty(wrapped, 'execute', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: tool.execute
      ? async (inputData: unknown, context?: BackgroundWorkExecutionContext) => {
          if (context) {
            await registerBackgroundWorkNotifier(context, binding.sendSignal);
          }
          return tool.execute!(inputData as never, context as never);
        }
      : undefined,
  });
  return wrapped as typeof tool;
}

/**
 * Retains the active caller's signal capability on stable per-run tool wrappers.
 * Native agent background execution remains responsible for dispatch, persistence,
 * result reconciliation, and continuation.
 */
export function createBackgroundWorkSignalProcessor(): InputProcessor {
  return {
    id: 'background-work-signals',
    processInputStep: async ({ runId, sendSignal, tools, agent }) => {
      if (!runId || !sendSignal || !tools) {
        return {};
      }

      const scope = agent?.getMastraInstance()?.__getRunScope(runId);
      if (!scope) {
        return {};
      }

      let wrappers = scope.get(BACKGROUND_WORK_WRAPPERS);
      if (!wrappers) {
        wrappers = new WeakMap();
        scope.set(BACKGROUND_WORK_WRAPPERS, wrappers);
      }

      let changed = false;
      const nextTools: Record<string, unknown> = { ...tools };
      for (const [name, candidate] of Object.entries(tools)) {
        if (
          !candidate ||
          typeof candidate !== 'object' ||
          typeof (candidate as ExecutableTool).execute !== 'function'
        ) {
          continue;
        }

        const tool = candidate as ExecutableTool;
        let entry = wrappers.get(tool);
        if (!entry) {
          const binding = { sendSignal };
          entry = { tool: wrapTool(tool, binding), binding };
          wrappers.set(tool, entry);
        } else {
          entry.binding.sendSignal = sendSignal;
        }

        nextTools[name] = entry.tool;
        changed = true;
      }

      return changed ? { tools: nextTools } : {};
    },
  };
}
