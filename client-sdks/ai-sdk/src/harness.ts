import type {
  HarnessDisplayState,
  HarnessDisplayStateListener,
  HarnessDisplayStateSubscriptionOptions,
  HarnessMessageContent,
} from '@mastra/core/harness';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type HarnessUIStreamDomain =
  | 'text'
  | 'reasoning'
  | 'usage'
  | 'tools'
  | 'hitl'
  | 'tasks'
  | 'om'
  | 'files'
  | 'subagents';

export type HarnessUIStreamMode = 'snapshot' | 'delta';

export interface HarnessToUIMessageStreamOptions {
  mode?: HarnessUIStreamMode;
  include?: readonly HarnessUIStreamDomain[];
  windowMs?: number;
  maxWaitMs?: number;
  messageId?: string | ((state: HarnessDisplayState) => string);
  sendStart?: boolean;
  sendFinish?: boolean;
  version?: 'v5' | 'v6';
}

export interface HarnessLike {
  getDisplayState(): Readonly<HarnessDisplayState>;
  subscribeDisplayState(
    listener: HarnessDisplayStateListener,
    options?: HarnessDisplayStateSubscriptionOptions,
  ): () => void;
}

export interface HarnessUIMessageSnapshot {
  id: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: string;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
  text?: string;
  reasoning?: string;
  content: JsonValue[];
}

export interface HarnessUISnapshotData {
  version: 1;
  sequence: number;
  emittedAt: string;
  mode: 'snapshot';
  messageId: string;
  isRunning: boolean;
  currentMessage: HarnessUIMessageSnapshot | null;
  domains: {
    usage?: JsonValue;
    tools?: JsonValue;
    hitl?: JsonValue;
    tasks?: JsonValue;
    om?: JsonValue;
    files?: JsonValue;
    subagents?: JsonValue;
  };
}

export interface HarnessUIDeltaData {
  version: 1;
  sequence: number;
  emittedAt: string;
  mode: 'delta';
  messageId: string;
  isRunning?: boolean;
  currentMessage?: HarnessUIMessageSnapshot | null;
  domains?: HarnessUISnapshotData['domains'];
}

export type HarnessUISnapshotDataPart = {
  type: 'data-mastra-harness-snapshot';
  id: 'mastra-harness:snapshot';
  data: HarnessUISnapshotData;
};

export type HarnessUIDeltaDataPart = {
  type: 'data-mastra-harness-delta';
  id: string;
  data: HarnessUIDeltaData;
};

export type HarnessUIErrorDataPart = {
  type: 'data-mastra-harness-error';
  id: 'mastra-harness:error';
  data: {
    message: string;
    errorType?: string;
  };
};

export type HarnessUIDataPart = HarnessUISnapshotDataPart | HarnessUIDeltaDataPart | HarnessUIErrorDataPart;

type HarnessUITextChunk =
  | { type: 'start'; messageId?: string }
  | { type: 'finish' }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'tool-input-start'; toolCallId: string; toolName: string }
  | { type: 'tool-input-delta'; toolCallId: string; inputTextDelta: string }
  | { type: 'tool-input-available'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'tool-output-error'; toolCallId: string; errorText: string };

export type HarnessUIMessageStreamChunk = HarnessUITextChunk | HarnessUIDataPart;

const DEFAULT_DOMAINS: readonly HarnessUIStreamDomain[] = [
  'text',
  'reasoning',
  'usage',
  'tools',
  'hitl',
  'tasks',
  'om',
  'files',
  'subagents',
];

const SNAPSHOT_PART_ID = 'mastra-harness:snapshot';
const DEFAULT_MESSAGE_ID = 'mastra-harness';

type StreamTextState = {
  id: string | null;
  value: string;
  open: boolean;
};

type NativeToolStreamState = {
  inputStarted: boolean;
  inputBuffer: string;
  inputAvailable: boolean;
  outputEmitted: boolean;
};

type EmitContext = {
  controller: ReadableStreamDefaultController<HarnessUIMessageStreamChunk>;
  include: ReadonlySet<HarnessUIStreamDomain>;
  mode: HarnessUIStreamMode;
  resolveMessageId: (state: HarnessDisplayState) => string;
  text: StreamTextState;
  reasoning: StreamTextState;
  tools: Map<string, NativeToolStreamState>;
  lastSnapshot: HarnessUISnapshotData | null;
  sequence: number;
  sendStart: boolean;
  sendFinish: boolean;
  started: boolean;
};

export function harnessToUIMessageStream(
  harness: HarnessLike,
  options: HarnessToUIMessageStreamOptions = {},
): ReadableStream<HarnessUIMessageStreamChunk> {
  const mode = options.mode ?? 'snapshot';
  const include = new Set(options.include ?? DEFAULT_DOMAINS);
  const windowMs = options.windowMs ?? 250;
  const maxWaitMs = options.maxWaitMs ?? 500;
  const sendStart = options.sendStart ?? true;
  const sendFinish = options.sendFinish ?? true;
  const resolveMessageId = createMessageIdResolver(options.messageId);

  let unsubscribe: (() => void) | undefined;
  let closed = false;

  return new ReadableStream<HarnessUIMessageStreamChunk>({
    start(controller) {
      const context: EmitContext = {
        controller,
        include,
        mode,
        resolveMessageId,
        text: { id: null, value: '', open: false },
        reasoning: { id: null, value: '', open: false },
        tools: new Map(),
        lastSnapshot: null,
        sequence: 0,
        sendStart,
        sendFinish,
        started: false,
      };

      const closeStream = () => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe?.();
        controller.close();
      };

      const failStream = (error: unknown) => {
        if (closed) {
          return;
        }
        closed = true;
        unsubscribe?.();
        controller.error(error);
      };

      const emit = (state: HarnessDisplayState) => {
        if (closed) {
          return;
        }

        try {
          emitDisplayState(state, context);

          if (!state.isRunning) {
            closeOpenTextPart(context.text, controller, 'text-end');
            closeOpenTextPart(context.reasoning, controller, 'reasoning-end');
            if (sendFinish) {
              controller.enqueue({ type: 'finish' });
            }
            closeStream();
          }
        } catch (error) {
          failStream(error);
        }
      };

      emit(harness.getDisplayState() as HarnessDisplayState);

      if (!closed) {
        unsubscribe = harness.subscribeDisplayState(emit, { windowMs, maxWaitMs });
      }
    },

    cancel() {
      closed = true;
      unsubscribe?.();
    },
  });
}

function emitDisplayState(state: HarnessDisplayState, context: EmitContext): void {
  const messageId = context.resolveMessageId(state);

  if (!context.started) {
    context.started = true;
    if (context.sendStart) {
      context.controller.enqueue({ type: 'start', messageId });
    }
  }

  if (context.include.has('text')) {
    emitGrowingTextPart({
      controller: context.controller,
      streamState: context.text,
      emitReplacementForSameId: context.mode === 'snapshot',
      id: `${messageId}:text`,
      value: getMessageText(state),
      startType: 'text-start',
      deltaType: 'text-delta',
      endType: 'text-end',
    });
  }

  if (context.include.has('reasoning')) {
    emitGrowingTextPart({
      controller: context.controller,
      streamState: context.reasoning,
      emitReplacementForSameId: context.mode === 'snapshot',
      id: `${messageId}:reasoning`,
      value: getMessageReasoning(state),
      startType: 'reasoning-start',
      deltaType: 'reasoning-delta',
      endType: 'reasoning-end',
    });
  }

  if (context.include.has('tools')) {
    emitNativeToolChunks(state, context);
  }

  context.sequence += 1;
  const snapshot = createSnapshotData(state, {
    include: context.include,
    messageId,
    sequence: context.sequence,
  });

  if (context.mode === 'snapshot' || !context.lastSnapshot) {
    context.controller.enqueue({
      type: 'data-mastra-harness-snapshot',
      id: SNAPSHOT_PART_ID,
      data: snapshot,
    });
  } else {
    const delta = createDeltaData(context.lastSnapshot, snapshot);
    if (delta) {
      context.controller.enqueue({
        type: 'data-mastra-harness-delta',
        id: `mastra-harness:delta:${snapshot.sequence}`,
        data: delta,
      });
    }
  }

  context.lastSnapshot = snapshot;
}

function emitGrowingTextPart(args: {
  controller: ReadableStreamDefaultController<HarnessUIMessageStreamChunk>;
  streamState: StreamTextState;
  emitReplacementForSameId: boolean;
  id: string;
  value: string;
  startType: 'text-start' | 'reasoning-start';
  deltaType: 'text-delta' | 'reasoning-delta';
  endType: 'text-end' | 'reasoning-end';
}): void {
  const { controller, streamState, emitReplacementForSameId, id, value, startType, deltaType, endType } = args;

  if (!value) {
    closeOpenTextPart(streamState, controller, endType);
    return;
  }

  const sameId = streamState.id === id;
  const isAppend = value.startsWith(streamState.value);
  const shouldRestart = !streamState.open || !sameId || (emitReplacementForSameId && !isAppend);

  if (shouldRestart) {
    closeOpenTextPart(streamState, controller, endType);
    controller.enqueue({ type: startType, id } as HarnessUIMessageStreamChunk);
    controller.enqueue({ type: deltaType, id, delta: value } as HarnessUIMessageStreamChunk);
  } else if (isAppend && value.length > streamState.value.length) {
    controller.enqueue({
      type: deltaType,
      id,
      delta: value.slice(streamState.value.length),
    } as HarnessUIMessageStreamChunk);
  }

  streamState.id = id;
  streamState.value = value;
  streamState.open = true;
}

function closeOpenTextPart(
  streamState: StreamTextState,
  controller: ReadableStreamDefaultController<HarnessUIMessageStreamChunk>,
  type: 'text-end' | 'reasoning-end',
): void {
  if (!streamState.open || !streamState.id) {
    return;
  }

  controller.enqueue({ type, id: streamState.id } as HarnessUIMessageStreamChunk);
  streamState.id = null;
  streamState.value = '';
  streamState.open = false;
}

function emitNativeToolChunks(state: HarnessDisplayState, context: EmitContext): void {
  for (const [toolCallId, tool] of state.activeTools) {
    const toolState = context.tools.get(toolCallId) ?? {
      inputStarted: false,
      inputBuffer: '',
      inputAvailable: false,
      outputEmitted: false,
    };
    context.tools.set(toolCallId, toolState);

    const inputBuffer = state.toolInputBuffers.get(toolCallId);
    if (inputBuffer) {
      if (!toolState.inputStarted) {
        context.controller.enqueue({
          type: 'tool-input-start',
          toolCallId,
          toolName: inputBuffer.toolName || tool.name,
        });
        toolState.inputStarted = true;
      }

      if (
        inputBuffer.text.startsWith(toolState.inputBuffer) &&
        inputBuffer.text.length > toolState.inputBuffer.length
      ) {
        context.controller.enqueue({
          type: 'tool-input-delta',
          toolCallId,
          inputTextDelta: inputBuffer.text.slice(toolState.inputBuffer.length),
        });
      }

      toolState.inputBuffer = inputBuffer.text;
    }

    if (!toolState.inputAvailable && tool.status !== 'streaming_input') {
      context.controller.enqueue({
        type: 'tool-input-available',
        toolCallId,
        toolName: tool.name,
        input: tool.args,
      });
      toolState.inputAvailable = true;
    }

    if (!toolState.outputEmitted && tool.status === 'completed') {
      context.controller.enqueue({
        type: 'tool-output-available',
        toolCallId,
        output: tool.result,
      });
      toolState.outputEmitted = true;
    }

    if (!toolState.outputEmitted && tool.status === 'error') {
      context.controller.enqueue({
        type: 'tool-output-error',
        toolCallId,
        errorText: stringifyToolError(tool.result ?? tool.partialResult ?? 'Tool execution failed'),
      });
      toolState.outputEmitted = true;
    }
  }
}

function createSnapshotData(
  state: HarnessDisplayState,
  args: {
    include: ReadonlySet<HarnessUIStreamDomain>;
    messageId: string;
    sequence: number;
  },
): HarnessUISnapshotData {
  const { include, messageId, sequence } = args;
  const domains: HarnessUISnapshotData['domains'] = {};

  if (include.has('usage')) {
    domains.usage = toJsonValue(state.tokenUsage) ?? null;
  }

  if (include.has('tools')) {
    domains.tools = {
      active: mapToRecord(state.activeTools),
      inputBuffers: mapToRecord(state.toolInputBuffers),
    };
  }

  if (include.has('hitl')) {
    domains.hitl = {
      approval: toJsonValue(state.pendingApproval) ?? null,
      suspension: toJsonValue(state.pendingSuspension) ?? null,
      question: toJsonValue(state.pendingQuestion) ?? null,
      planApproval: toJsonValue(state.pendingPlanApproval) ?? null,
    };
  }

  if (include.has('tasks')) {
    domains.tasks = {
      current: toJsonValue(state.tasks) ?? [],
      previous: toJsonValue(state.previousTasks) ?? [],
    };
  }

  if (include.has('om')) {
    domains.om = {
      progress: toJsonValue(state.omProgress) ?? null,
      bufferingMessages: state.bufferingMessages,
      bufferingObservations: state.bufferingObservations,
    };
  }

  if (include.has('files')) {
    domains.files = mapToRecord(state.modifiedFiles);
  }

  if (include.has('subagents')) {
    const stateWithHistory = state as HarnessDisplayState & { subagentHistory?: unknown };
    domains.subagents = {
      active: mapToRecord(state.activeSubagents),
      history: toJsonValue(stateWithHistory.subagentHistory) ?? [],
    };
  }

  return {
    version: 1,
    sequence,
    emittedAt: new Date().toISOString(),
    mode: 'snapshot',
    messageId,
    isRunning: state.isRunning,
    currentMessage: createMessageSnapshot(state, include),
    domains,
  };
}

function createMessageSnapshot(
  state: HarnessDisplayState,
  include: ReadonlySet<HarnessUIStreamDomain>,
): HarnessUIMessageSnapshot | null {
  const message = state.currentMessage;

  if (!message) {
    return null;
  }

  const content = message.content.flatMap(part => {
    if (!shouldIncludeMessageContent(part, include)) {
      return [];
    }
    const value = toJsonValue(part);
    return value === undefined ? [] : [value];
  });

  return {
    id: message.id,
    role: message.role,
    createdAt: message.createdAt.toISOString(),
    ...(message.stopReason ? { stopReason: message.stopReason } : {}),
    ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
    ...(include.has('text') ? { text: getMessageText(state) } : {}),
    ...(include.has('reasoning') ? { reasoning: getMessageReasoning(state) } : {}),
    content,
  };
}

function createDeltaData(previous: HarnessUISnapshotData, current: HarnessUISnapshotData): HarnessUIDeltaData | null {
  const delta: HarnessUIDeltaData = {
    version: 1,
    sequence: current.sequence,
    emittedAt: current.emittedAt,
    mode: 'delta',
    messageId: current.messageId,
  };

  if (previous.isRunning !== current.isRunning) {
    delta.isRunning = current.isRunning;
  }

  if (stableStringify(previous.currentMessage) !== stableStringify(current.currentMessage)) {
    delta.currentMessage = current.currentMessage;
  }

  const domains: HarnessUISnapshotData['domains'] = {};
  const domainKeys = new Set([...Object.keys(previous.domains), ...Object.keys(current.domains)] as Array<
    keyof HarnessUISnapshotData['domains']
  >);

  for (const key of domainKeys) {
    if (stableStringify(previous.domains[key]) !== stableStringify(current.domains[key])) {
      domains[key] = current.domains[key] ?? null;
    }
  }

  if (Object.keys(domains).length > 0) {
    delta.domains = domains;
  }

  if (delta.isRunning === undefined && delta.currentMessage === undefined && delta.domains === undefined) {
    return null;
  }

  return delta;
}

function shouldIncludeMessageContent(
  part: HarnessMessageContent,
  include: ReadonlySet<HarnessUIStreamDomain>,
): boolean {
  if (part.type === 'text') {
    return include.has('text');
  }

  if (part.type === 'thinking') {
    return include.has('reasoning');
  }

  if (part.type === 'tool_call' || part.type === 'tool_result') {
    return include.has('tools');
  }

  if (part.type.startsWith('om_')) {
    return include.has('om');
  }

  return true;
}

function getMessageText(state: HarnessDisplayState): string {
  return (
    state.currentMessage?.content
      .filter((part): part is Extract<HarnessMessageContent, { type: 'text' }> => part.type === 'text')
      .map(part => part.text)
      .join('') ?? ''
  );
}

function getMessageReasoning(state: HarnessDisplayState): string {
  return (
    state.currentMessage?.content
      .filter((part): part is Extract<HarnessMessageContent, { type: 'thinking' }> => part.type === 'thinking')
      .map(part => part.thinking)
      .join('') ?? ''
  );
}

function createMessageIdResolver(
  messageId: HarnessToUIMessageStreamOptions['messageId'],
): (state: HarnessDisplayState) => string {
  if (typeof messageId === 'function') {
    return state => messageId(state) || state.currentMessage?.id || DEFAULT_MESSAGE_ID;
  }

  if (typeof messageId === 'string') {
    return () => messageId;
  }

  return state => state.currentMessage?.id || DEFAULT_MESSAGE_ID;
}

function stringifyToolError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  const json = toJsonValue(error);
  return typeof json === 'string' ? json : (JSON.stringify(json) ?? 'Tool execution failed');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function mapToRecord(map: Map<string, unknown>): { [key: string]: JsonValue } {
  const record: { [key: string]: JsonValue } = {};

  for (const [key, value] of map) {
    record[key] = toJsonValue(value) ?? null;
  }

  return record;
}

function toJsonValue(value: unknown, seen = new WeakSet<object>()): JsonValue | undefined {
  if (value === null) {
    return null;
  }

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
      return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const jsonValue = value.map(item => toJsonValue(item, seen) ?? null);
    seen.delete(value);
    return jsonValue;
  }

  if (value instanceof Map) {
    const record: { [key: string]: JsonValue } = {};
    for (const [key, mapValue] of value) {
      const jsonValue = toJsonValue(mapValue, seen);
      if (jsonValue !== undefined) {
        record[String(key)] = jsonValue;
      }
    }
    seen.delete(value);
    return record;
  }

  if (value instanceof Set) {
    const jsonValue = Array.from(value, item => toJsonValue(item, seen) ?? null);
    seen.delete(value);
    return jsonValue;
  }

  const record: { [key: string]: JsonValue } = {};
  for (const [key, objectValue] of Object.entries(value)) {
    const jsonValue = toJsonValue(objectValue, seen);
    if (jsonValue !== undefined) {
      record[key] = jsonValue;
    }
  }

  seen.delete(value);
  return record;
}
