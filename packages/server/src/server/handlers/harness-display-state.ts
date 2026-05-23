import type {
  HarnessDisplayActiveSubagentSnapshotV1,
  HarnessDisplayActiveToolSnapshotV1,
  HarnessDisplayJsonValue,
  HarnessDisplayPendingSnapshotV1,
  HarnessDisplayStateSnapshotV1,
  SessionDisplayState,
} from '@mastra/core/harness/v1';

type ActiveToolState = SessionDisplayState['activeTools'][string];
type ActiveSubagentState = SessionDisplayState['activeSubagents'][string];
type SessionDisplayPending = NonNullable<SessionDisplayState['pending']>;

function toHarnessDisplayJsonValue(value: unknown, seen = new WeakSet<object>()): HarnessDisplayJsonValue {
  if (value === null) return null;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : null;
    case 'bigint':
      return value.toString();
    case 'undefined':
    case 'function':
    case 'symbol':
      return null;
    case 'object':
      break;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : null;
  }

  if (seen.has(value)) return null;
  seen.add(value);

  try {
    const toJSON = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === 'function' && !Array.isArray(value)) {
      return toHarnessDisplayJsonValue(toJSON.call(value), seen);
    }

    if (Array.isArray(value)) {
      return value.map(item => toHarnessDisplayJsonValue(item, seen));
    }

    const output: Record<string, HarnessDisplayJsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue;
      Object.defineProperty(output, key, {
        value: toHarnessDisplayJsonValue(child, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return output;
  } catch {
    return null;
  } finally {
    seen.delete(value);
  }
}

function encodeActiveTool(tool: ActiveToolState): HarnessDisplayActiveToolSnapshotV1 {
  const encoded: HarnessDisplayActiveToolSnapshotV1 = {
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    args: toHarnessDisplayJsonValue(tool.args),
    startedAt: tool.startedAt,
  };
  if (tool.subagentSessionId !== undefined) encoded.subagentSessionId = tool.subagentSessionId;
  return encoded;
}

function encodeActiveSubagent(subagent: ActiveSubagentState): HarnessDisplayActiveSubagentSnapshotV1 {
  return {
    subagentSessionId: subagent.subagentSessionId,
    agentType: subagent.agentType,
    task: subagent.task,
    parentToolCallId: subagent.parentToolCallId,
    startedAt: subagent.startedAt,
  };
}

function encodePending(pending: SessionDisplayPending | null): HarnessDisplayPendingSnapshotV1 | null {
  if (!pending) return null;
  const { payload: _payload, ...pendingWithoutPayload } = pending;
  const encoded: HarnessDisplayPendingSnapshotV1 = pendingWithoutPayload;
  if (pending.payload !== undefined) encoded.payload = toHarnessDisplayJsonValue(pending.payload);
  return encoded;
}

export function toHarnessDisplayStateSnapshotV1(state: SessionDisplayState): HarnessDisplayStateSnapshotV1 {
  const snapshot: HarnessDisplayStateSnapshotV1 = {
    version: 1,
    sessionId: state.sessionId,
    threadId: state.threadId,
    resourceId: state.resourceId,
    lifecycleState: state.lifecycleState,
    modeId: state.modeId,
    modelId: state.modelId,
    createdAt: state.createdAt,
    lastActivityAt: state.lastActivityAt,
    isRunning: state.isRunning,
    activeTools: Object.fromEntries(
      Object.entries(state.activeTools).map(([id, tool]) => [id, encodeActiveTool(tool)]),
    ),
    toolInputBuffers: Object.fromEntries(
      Object.entries(state.toolInputBuffers).map(([id, buffer]) => [
        id,
        { toolName: buffer.toolName, text: buffer.text },
      ]),
    ),
    activeSubagents: Object.fromEntries(
      Object.entries(state.activeSubagents).map(([id, subagent]) => [id, encodeActiveSubagent(subagent)]),
    ),
    tokenUsage: { ...state.tokenUsage },
    pending: encodePending(state.pending),
    queueDepth: state.queueDepth,
  };

  if (state.parentSessionId !== undefined) snapshot.parentSessionId = state.parentSessionId;
  if (state.currentRunId !== undefined) snapshot.currentRunId = state.currentRunId;
  if (state.currentMessageId !== undefined) snapshot.currentMessageId = state.currentMessageId;
  if (state.currentTraceId !== undefined) snapshot.currentTraceId = state.currentTraceId;
  if (state.currentQueuedItemId !== undefined) snapshot.currentQueuedItemId = state.currentQueuedItemId;
  if (state.goal !== undefined) snapshot.goal = toHarnessDisplayJsonValue(state.goal);

  return snapshot;
}
