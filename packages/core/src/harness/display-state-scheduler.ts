import type { HarnessDisplayState, HarnessDisplayStateListener, HarnessEvent } from './types';

export const DEFAULT_DISPLAY_STATE_SUBSCRIPTION_OPTIONS = {
  windowMs: 250,
  maxWaitMs: 500,
} as const;

export const CRITICAL_DISPLAY_STATE_EVENT_TYPES: ReadonlySet<HarnessEvent['type']> = new Set([
  'agent_start',
  'agent_end',
  'error',
  'tool_approval_required',
  'tool_suspended',
  'ask_question',
  'plan_approval_required',
  'plan_approved',
  'thread_changed',
  'thread_created',
  'thread_deleted',
  'mode_changed',
  'model_changed',
  'subagent_model_changed',
  'state_changed',
  'tool_input_end',
  'tool_end',
  'subagent_end',
]);

function cloneValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    seen.set(value, cloned);
    for (const item of value) {
      cloned.push(cloneValue(item, seen));
    }
    return cloned;
  }

  if (value instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    seen.set(value, cloned);
    for (const [key, mapValue] of value) {
      cloned.set(cloneValue(key, seen), cloneValue(mapValue, seen));
    }
    return cloned;
  }

  if (value instanceof Set) {
    const cloned = new Set<unknown>();
    seen.set(value, cloned);
    for (const item of value) {
      cloned.add(cloneValue(item, seen));
    }
    return cloned;
  }

  const cloned: Record<PropertyKey, unknown> = {};
  seen.set(value, cloned);
  for (const key of Reflect.ownKeys(value)) {
    cloned[key] = cloneValue((value as Record<PropertyKey, unknown>)[key], seen);
  }
  return cloned;
}

function cloneUnknown<T>(value: T): T {
  return cloneValue(value) as T;
}

function cloneDisplayState(state: HarnessDisplayState): HarnessDisplayState {
  return {
    ...state,
    currentMessage: state.currentMessage
      ? {
          ...state.currentMessage,
          createdAt: new Date(state.currentMessage.createdAt.getTime()),
          content: state.currentMessage.content.map(part => cloneUnknown(part)),
        }
      : null,
    tokenUsage: { ...state.tokenUsage },
    activeTools: new Map(
      Array.from(state.activeTools, ([id, tool]) => [
        id,
        {
          ...tool,
          args: cloneUnknown(tool.args),
          result: cloneUnknown(tool.result),
        },
      ]),
    ),
    toolInputBuffers: new Map(Array.from(state.toolInputBuffers, ([id, buffer]) => [id, { ...buffer }])),
    pendingApproval: state.pendingApproval
      ? { ...state.pendingApproval, args: cloneUnknown(state.pendingApproval.args) }
      : null,
    pendingSuspension: state.pendingSuspension
      ? {
          ...state.pendingSuspension,
          args: cloneUnknown(state.pendingSuspension.args),
          suspendPayload: cloneUnknown(state.pendingSuspension.suspendPayload),
        }
      : null,
    pendingQuestion: state.pendingQuestion
      ? {
          ...state.pendingQuestion,
          options: state.pendingQuestion.options?.map(option => cloneUnknown(option)),
        }
      : null,
    pendingPlanApproval: state.pendingPlanApproval ? { ...state.pendingPlanApproval } : null,
    activeSubagents: new Map(
      Array.from(state.activeSubagents, ([id, subagent]) => [
        id,
        {
          ...subagent,
          toolCalls: subagent.toolCalls.map(toolCall => cloneUnknown(toolCall)),
        },
      ]),
    ),
    omProgress: {
      ...state.omProgress,
      buffered: {
        observations: { ...state.omProgress.buffered.observations },
        reflection: { ...state.omProgress.buffered.reflection },
      },
    },
    modifiedFiles: new Map(
      Array.from(state.modifiedFiles, ([path, modifiedFile]) => [
        path,
        {
          ...modifiedFile,
          firstModified: new Date(modifiedFile.firstModified.getTime()),
          operations: [...modifiedFile.operations],
        },
      ]),
    ),
    tasks: state.tasks.map(task => cloneUnknown(task)),
    previousTasks: state.previousTasks.map(task => cloneUnknown(task)),
  };
}

export class DisplayStateScheduler {
  private disposed = false;
  private pendingState: HarnessDisplayState | null = null;
  private windowTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly listener: HarnessDisplayStateListener,
    private readonly windowMs: number,
    private readonly maxWaitMs: number,
  ) {}

  notify(state: HarnessDisplayState, isCritical: boolean): void {
    if (this.disposed) return;

    if (isCritical) {
      this.flush(state);
      return;
    }

    this.pendingState = state;

    if (this.windowTimer) {
      clearTimeout(this.windowTimer);
    }
    this.windowTimer = setTimeout(() => this.flushPending(), this.windowMs);

    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(() => this.flushPending(), this.maxWaitMs);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.pendingState = null;
    this.clearTimers();
  }

  private flushPending(): void {
    if (!this.pendingState) return;
    this.flush(this.pendingState);
  }

  private flush(state: HarnessDisplayState): void {
    if (this.disposed) return;

    this.pendingState = null;
    this.clearTimers();

    try {
      const result = this.listener(cloneDisplayState(state));
      if (result && typeof result === 'object' && 'catch' in result && typeof result.catch === 'function') {
        (result as Promise<void>).catch(err => console.error('Error in harness display state listener:', err));
      }
    } catch (err) {
      console.error('Error in harness display state listener:', err);
    }
  }

  private clearTimers(): void {
    if (this.windowTimer) {
      clearTimeout(this.windowTimer);
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer);
    }
    this.windowTimer = null;
    this.maxWaitTimer = null;
  }
}
