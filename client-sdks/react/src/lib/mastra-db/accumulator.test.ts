import type { MastraDBMessage, MastraToolInvocationPart } from '@mastra/core/agent/message-list';
import { MessageList } from '@mastra/core/agent/message-list';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { accumulateChunk, finishStreamingAssistantMessage } from './accumulator';
import { CLIENT_MESSAGE_ID_KEY } from './types';
import type { BackgroundTaskEntry, MastraDBMessageMetadata, MastraReasoningPart, MastraTextPart } from './types';

const RUN_ID = 'run-1';

const streamMeta = (): MastraDBMessageMetadata => ({ mode: 'stream' });

// -----------------------------------------------------------------------------
// Chunk fixture builders (one per ChunkType variant exercised below).
// -----------------------------------------------------------------------------

const startChunk = (messageId = 'asst-1'): ChunkType =>
  ({
    type: 'start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { messageId },
  }) as unknown as ChunkType;

const stepStartChunk = (messageId?: string): ChunkType =>
  ({
    type: 'step-start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { ...(messageId ? { messageId } : {}) },
  }) as unknown as ChunkType;

const stepFinishChunk = (): ChunkType =>
  ({ type: 'step-finish', runId: RUN_ID, from: 'AGENT', payload: {} }) as unknown as ChunkType;

const stepOutputChunk = (): ChunkType =>
  ({ type: 'step-output', runId: RUN_ID, from: 'AGENT', payload: {} }) as unknown as ChunkType;

const rawChunk = (): ChunkType => ({ type: 'raw', runId: RUN_ID, from: 'AGENT', payload: {} }) as unknown as ChunkType;

const watchChunk = (): ChunkType =>
  ({ type: 'watch', runId: RUN_ID, from: 'AGENT', payload: {} }) as unknown as ChunkType;

const responseMetadataChunk = (): ChunkType =>
  ({ type: 'response-metadata', runId: RUN_ID, from: 'AGENT', payload: {} }) as unknown as ChunkType;

const objectChunk = (): ChunkType =>
  ({ type: 'object', runId: RUN_ID, from: 'AGENT', object: { x: 1 } }) as unknown as ChunkType;

const objectResultChunk = (): ChunkType =>
  ({ type: 'object-result', runId: RUN_ID, from: 'AGENT', object: { x: 1 } }) as unknown as ChunkType;

const errorChunk = (error: unknown): ChunkType =>
  ({ type: 'error', runId: RUN_ID, from: 'AGENT', payload: { error } }) as unknown as ChunkType;

const textStartChunk = (id: string, providerMetadata?: Record<string, unknown>): ChunkType =>
  ({
    type: 'text-start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { id, ...(providerMetadata ? { providerMetadata } : {}) },
  }) as unknown as ChunkType;

const textDeltaChunk = (id: string, text: string): ChunkType =>
  ({
    type: 'text-delta',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { id, text },
  }) as unknown as ChunkType;

const textEndChunk = (id: string): ChunkType =>
  ({
    type: 'text-end',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { id },
  }) as unknown as ChunkType;

const reasoningStartChunk = (providerMetadata?: Record<string, unknown>): ChunkType =>
  ({
    type: 'reasoning-start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { ...(providerMetadata ? { providerMetadata } : {}) },
  }) as unknown as ChunkType;

const reasoningDeltaChunk = (text: string): ChunkType =>
  ({
    type: 'reasoning-delta',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { text },
  }) as unknown as ChunkType;

const reasoningEndChunk = (providerMetadata?: Record<string, unknown>): ChunkType =>
  ({
    type: 'reasoning-end',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { ...(providerMetadata ? { providerMetadata } : {}) },
  }) as unknown as ChunkType;

const reasoningSignatureChunk = (providerMetadata: Record<string, unknown>): ChunkType =>
  ({
    type: 'reasoning-signature',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { providerMetadata },
  }) as unknown as ChunkType;

const redactedReasoningChunk = (data: string, providerMetadata?: Record<string, unknown>): ChunkType =>
  ({
    type: 'redacted-reasoning',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { data, ...(providerMetadata ? { providerMetadata } : {}) },
  }) as unknown as ChunkType;

const toolCallChunk = (toolCallId: string, toolName: string, args: Record<string, unknown>): ChunkType =>
  ({
    type: 'tool-call',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, toolName, args },
  }) as unknown as ChunkType;

const toolCallInputStreamingStartChunk = (toolCallId: string, toolName: string): ChunkType =>
  ({
    type: 'tool-call-input-streaming-start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, toolName },
  }) as unknown as ChunkType;

const toolCallDeltaChunk = (toolCallId: string, argsTextDelta: string): ChunkType =>
  ({
    type: 'tool-call-delta',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, argsTextDelta },
  }) as unknown as ChunkType;

const toolCallInputStreamingEndChunk = (toolCallId: string): ChunkType =>
  ({
    type: 'tool-call-input-streaming-end',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId },
  }) as unknown as ChunkType;

const toolResultChunk = (toolCallId: string, result: unknown): ChunkType =>
  ({
    type: 'tool-result',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, result },
  }) as unknown as ChunkType;

const toolErrorChunk = (toolCallId: string, error: string): ChunkType =>
  ({
    type: 'tool-error',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, error },
  }) as unknown as ChunkType;

const toolCallApprovalChunk = (toolCallId: string, toolName: string, args: Record<string, unknown>): ChunkType =>
  ({
    type: 'tool-call-approval',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, toolName, args },
  }) as unknown as ChunkType;

const toolCallSuspendedChunk = (
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  suspendPayload: unknown,
): ChunkType =>
  ({
    type: 'tool-call-suspended',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, toolName, args, suspendPayload },
  }) as unknown as ChunkType;

const toolOutputChunk = (toolCallId: string, output: unknown): ChunkType =>
  ({
    type: 'tool-output',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, output },
  }) as unknown as ChunkType;

const bgTaskStartedChunk = (toolCallId: string, taskId: string): ChunkType =>
  ({
    type: 'background-task-started',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, taskId },
  }) as unknown as ChunkType;

const bgTaskRunningChunk = (toolCallId: string, taskId: string, startedAt: Date): ChunkType =>
  ({
    type: 'background-task-running',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, taskId, startedAt },
  }) as unknown as ChunkType;

const bgTaskProgressChunk = (runningCount: number): ChunkType =>
  ({
    type: 'background-task-progress',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { runningCount },
  }) as unknown as ChunkType;

const bgTaskCompletedChunk = (toolCallId: string, taskId: string, result: unknown): ChunkType =>
  ({
    type: 'background-task-completed',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, taskId, result, completedAt: new Date() },
  }) as unknown as ChunkType;

const bgTaskFailedChunk = (toolCallId: string, taskId: string, error: string): ChunkType =>
  ({
    type: 'background-task-failed',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, taskId, error, completedAt: new Date() },
  }) as unknown as ChunkType;

const bgTaskCancelledChunk = (toolCallId: string, taskId: string): ChunkType =>
  ({
    type: 'background-task-cancelled',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, taskId },
  }) as unknown as ChunkType;

const bgTaskOutputChunk = (toolCallId: string, output: unknown): ChunkType =>
  ({
    type: 'background-task-output',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, payload: { payload: { output } } },
  }) as unknown as ChunkType;

const bgTaskSuspendedChunk = (
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  suspendPayload: unknown,
  taskId: string,
): ChunkType =>
  ({
    type: 'background-task-suspended',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, toolName, args, suspendPayload, taskId, suspendedAt: new Date() },
  }) as unknown as ChunkType;

const bgTaskResumedChunk = (toolCallId: string, taskId: string): ChunkType =>
  ({
    type: 'background-task-resumed',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, taskId },
  }) as unknown as ChunkType;

const sourceUrlChunk = (id: string, url: string, title?: string): ChunkType =>
  ({
    type: 'source',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { sourceType: 'url', id, url, title },
  }) as unknown as ChunkType;

const sourceDocumentChunk = (id: string, mimeType: string, title?: string, filename?: string): ChunkType =>
  ({
    type: 'source',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { sourceType: 'document', id, mimeType, title, filename },
  }) as unknown as ChunkType;

const fileChunkBase64 = (mimeType: string, data: string): ChunkType =>
  ({
    type: 'file',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { mimeType, data, base64: true },
  }) as unknown as ChunkType;

const fileChunkPlain = (mimeType: string, data: string): ChunkType =>
  ({
    type: 'file',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { mimeType, data, base64: false },
  }) as unknown as ChunkType;

const fileChunkBinary = (mimeType: string, data: Uint8Array): ChunkType =>
  ({
    type: 'file',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { mimeType, data },
  }) as unknown as ChunkType;

const isTaskCompleteChunk = (passed: boolean, suppressFeedback = false): ChunkType =>
  ({
    type: 'is-task-complete',
    runId: RUN_ID,
    from: 'AGENT',
    payload: {
      passed,
      suppressFeedback,
      results: [],
      duration: 5,
      timedOut: false,
      reason: 'done',
      maxIterationReached: false,
    },
  }) as unknown as ChunkType;

const goalChunk = (passed: boolean): ChunkType =>
  ({
    type: 'goal',
    runId: RUN_ID,
    from: 'AGENT',
    payload: {
      objective: 'Ship the feature',
      iteration: 1,
      maxRuns: 50,
      passed,
      status: passed ? 'done' : 'active',
      results: [],
      reason: passed ? 'Goal achieved' : 'Not yet',
      duration: 5,
      timedOut: false,
      maxRunsReached: false,
      suppressFeedback: false,
    },
  }) as unknown as ChunkType;

const finishChunk = (finishReason = 'stop'): ChunkType =>
  ({
    type: 'finish',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { finishReason },
  }) as unknown as ChunkType;

const abortChunk = (): ChunkType =>
  ({
    type: 'abort',
    runId: RUN_ID,
    from: 'AGENT',
    payload: {},
  }) as unknown as ChunkType;

const tripwireChunk = (reason: string): ChunkType =>
  ({
    type: 'tripwire',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { reason, retry: false, metadata: { hint: 'blocked' }, processorId: 'guardrail-1' },
  }) as unknown as ChunkType;

const dataPartChunk = (suffix: string, data: unknown): ChunkType =>
  ({
    type: `data-${suffix}` as `data-${string}`,
    runId: RUN_ID,
    from: 'AGENT',
    data,
  }) as unknown as ChunkType;

// The live server emits the signal echo with `data.type: 'user'`; default to
// that real wire value so the fixture cannot drift back to masking the guard.
const dataUserMessageChunk = (
  id: string,
  contents: unknown,
  dataType: 'user' | 'user-message' = 'user',
  clientMessageId?: string,
): ChunkType =>
  ({
    type: 'data-user-message',
    runId: RUN_ID,
    from: 'AGENT',
    data: {
      type: dataType,
      id,
      contents,
      ...(clientMessageId ? { metadata: { [CLIENT_MESSAGE_ID_KEY]: clientMessageId } } : {}),
    },
  }) as unknown as ChunkType;

// An optimistically-appended user message awaiting its server echo. Mirrors what
// `useChat.sendMessage` puts into local state on the signal path: a client-side
// id plus the transient `clientMessageId` correlation key.
const pendingUserMessage = (id: string, text: string, clientMessageId = id): MastraDBMessage => ({
  id,
  role: 'user',
  createdAt: new Date(),
  content: {
    format: 2,
    parts: [{ type: 'text', text }],
    metadata: { mode: 'stream', status: 'pending', [CLIENT_MESSAGE_ID_KEY]: clientMessageId },
  },
});

const passthroughChunk = (type: string): ChunkType =>
  ({ type, runId: RUN_ID, from: 'AGENT', payload: {} }) as unknown as ChunkType;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const reduce = (
  chunks: ChunkType[],
  metadata: MastraDBMessageMetadata = streamMeta(),
  initial: MastraDBMessage[] = [],
): MastraDBMessage[] =>
  chunks.reduce((conv, chunk) => accumulateChunk({ chunk, conversation: conv, metadata }), initial);

// =============================================================================
// LIFECYCLE
// =============================================================================

describe('accumulateChunk - lifecycle', () => {
  it('start chunk appends a new empty assistant message', () => {
    const out = reduce([startChunk('asst-1')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'asst-1',
      role: 'assistant',
      content: { format: 2, parts: [] },
    });
  });

  it('start chunk dedupes by messageId', () => {
    const out = reduce([startChunk('asst-1'), startChunk('asst-1')]);
    expect(out).toHaveLength(1);
  });

  it('step-start without a message id is a no-op', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([stepStartChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('step-start with the current message id is a no-op', () => {
    const initial = reduce([startChunk('asst-1')]);
    const out = reduce([stepStartChunk('asst-1')], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('step-start with a rotated message id re-keys the empty pending assistant message', () => {
    const out = reduce([startChunk('asst-1'), stepStartChunk('rotated-1')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'rotated-1', role: 'assistant', content: { parts: [] } });
  });

  it('step-start with a rotated message id re-keys a pending message that only holds data-* parts', () => {
    const out = reduce([
      startChunk('asst-1'),
      dataPartChunk('om-status', { status: 'buffering' }),
      stepStartChunk('rotated-1'),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('rotated-1');
    expect(out[0].content.parts).toMatchObject([{ type: 'data-om-status', data: { status: 'buffering' } }]);
  });

  it('step-start with a rotated message id splits after content has streamed', () => {
    const out = reduce([
      startChunk('asst-1'),
      stepStartChunk('asst-1'),
      textStartChunk('t1'),
      textDeltaChunk('t1', 'hello'),
      textEndChunk('t1'),
      stepStartChunk('rotated-1'),
      textStartChunk('t2'),
      textDeltaChunk('t2', 'world'),
      textEndChunk('t2'),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('asst-1');
    expect(out[0].content.parts).toMatchObject([{ type: 'text', text: 'hello', state: 'done' }]);
    expect(out[1].id).toBe('rotated-1');
    expect(out[1].content.parts).toMatchObject([{ type: 'text', text: 'world' }]);
  });

  it('step-finish is a no-op', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([stepFinishChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('step-output is a no-op', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([stepOutputChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('raw is a no-op', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([rawChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('watch is a no-op', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([watchChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('response-metadata is a no-op', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([responseMetadataChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('object is a no-op (not stored on DB messages)', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([objectChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('object-result is a no-op (not stored on DB messages)', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([objectResultChunk()], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('error emits an assistant message with status=error', () => {
    const out = reduce([errorChunk('boom')]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    expect(out[0].content.metadata).toMatchObject({ status: 'error' });
    expect(out[0].content.parts[0]).toMatchObject({ type: 'text', text: 'boom' });
  });

  it('error with non-string error JSON-stringifies the payload', () => {
    const out = reduce([errorChunk({ code: 42 })]);
    const text = out[0].content.parts[0] as MastraTextPart;
    expect(text.text).toBe('{"code":42}');
  });
});

// =============================================================================
// TEXT STREAMING
// =============================================================================

describe('accumulateChunk - text streaming', () => {
  it('text-start creates a streaming text part with the given textId', () => {
    const out = reduce([startChunk(), textStartChunk('t1')]);
    const text = out[0].content.parts[0] as MastraTextPart;
    expect(text).toMatchObject({ type: 'text', text: '', state: 'streaming', textId: 't1' });
  });

  it('text-delta accumulates by textId', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'Hel'), textDeltaChunk('t1', 'lo')]);
    expect(out).toHaveLength(1);
    const textPart = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(textPart.text).toBe('Hello');
    expect(textPart.state).toBe('streaming');
    expect(textPart.textId).toBe('t1');
  });

  it('text-end is a no-op (final state set by finish)', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'hi'), textEndChunk('t1')]);
    const textPart = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(textPart.text).toBe('hi');
    expect(textPart.state).toBe('streaming');
  });

  it('text-delta without prior assistant creates one', () => {
    const out = reduce([textDeltaChunk('t1', 'orphan')]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    const textPart = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(textPart.text).toBe('orphan');
  });

  it('finish marks streaming text parts done', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'hi'), finishChunk('stop')]);
    const text = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(text.state).toBe('done');
  });
});

// =============================================================================
// REASONING STREAMING
// =============================================================================

describe('accumulateChunk - reasoning streaming', () => {
  it('reasoning-start creates a streaming reasoning part', () => {
    const out = reduce([startChunk(), reasoningStartChunk({ openai: { id: 'r1' } })]);
    const reasoning = out[0].content.parts.find(p => p.type === 'reasoning') as MastraReasoningPart;
    expect(reasoning).toMatchObject({ type: 'reasoning', reasoning: '', state: 'streaming' });
    expect(reasoning.providerMetadata).toEqual({ openai: { id: 'r1' } });
  });

  it('reasoning-delta coalesces consecutive chunks', () => {
    const out = reduce([
      startChunk(),
      reasoningStartChunk(),
      reasoningDeltaChunk('Think'),
      reasoningDeltaChunk('ing...'),
    ]);
    const reasoning = out[0].content.parts.find(p => p.type === 'reasoning') as MastraReasoningPart;
    expect(reasoning.reasoning).toBe('Thinking...');
    expect(reasoning.state).toBe('streaming');
  });

  it('reasoning-end marks the reasoning part done and shallow-merges providerMetadata', () => {
    const out = reduce([
      startChunk(),
      reasoningStartChunk({ anthropic: { id: 'r1' } }),
      reasoningDeltaChunk('done'),
      reasoningEndChunk({ openai: { stop: true } }),
    ]);
    const reasoning = out[0].content.parts.find(p => p.type === 'reasoning') as MastraReasoningPart;
    expect(reasoning.state).toBe('done');
    expect(reasoning.providerMetadata).toEqual({ anthropic: { id: 'r1' }, openai: { stop: true } });
  });

  it('reasoning-signature merges providerMetadata onto the most recent reasoning part', () => {
    const out = reduce([
      startChunk(),
      reasoningStartChunk({ openai: { id: 'r1' } }),
      reasoningSignatureChunk({ signature: 'abc' }),
    ]);
    const reasoning = out[0].content.parts.find(p => p.type === 'reasoning') as MastraReasoningPart;
    expect(reasoning.providerMetadata).toEqual({ openai: { id: 'r1' }, signature: 'abc' });
  });

  it('redacted-reasoning emits a done reasoning part flagged as redacted', () => {
    const out = reduce([startChunk(), redactedReasoningChunk('[redacted]')]);
    const reasoning = out[0].content.parts.find(p => p.type === 'reasoning') as MastraReasoningPart;
    expect(reasoning).toMatchObject({
      type: 'reasoning',
      reasoning: '[redacted]',
      state: 'done',
      redacted: true,
    });
  });
});

// =============================================================================
// TOOL CALLS
// =============================================================================

describe('accumulateChunk - tool calls', () => {
  it('tool-call creates a call-state tool-invocation part', () => {
    const out = reduce([startChunk(), toolCallChunk('tc-1', 'search', { query: 'mastra' })]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'call',
      toolCallId: 'tc-1',
      toolName: 'search',
      args: { query: 'mastra' },
    });
  });

  it('tool-call without prior assistant creates one', () => {
    const out = reduce([toolCallChunk('tc-1', 'search', { q: 'x' })]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    expect(out[0].content.parts[0]).toMatchObject({ type: 'tool-invocation' });
  });

  it('tool-call → tool-result transitions through call → result', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'search', { query: 'mastra' }),
      toolResultChunk('tc-1', { hits: 3 }),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'result',
      toolCallId: 'tc-1',
      toolName: 'search',
      args: { query: 'mastra' },
    });
    expect((toolPart.toolInvocation as { result: unknown }).result).toEqual({ hits: 3 });
  });

  it('tool-error transitions to output-error with errorText', () => {
    const out = reduce([startChunk(), toolCallChunk('tc-1', 'search', {}), toolErrorChunk('tc-1', 'boom')]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'output-error',
      toolCallId: 'tc-1',
      errorText: 'boom',
    });
  });

  it('tool-call-input-streaming-start creates a partial-call placeholder', () => {
    const out = reduce([startChunk(), toolCallInputStreamingStartChunk('tc-1', 'search')]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'partial-call',
      toolCallId: 'tc-1',
      toolName: 'search',
      args: {},
    });
  });

  it('tool-call-delta buffers fragments and end transitions to call with parsed args', () => {
    const out = reduce([
      startChunk(),
      toolCallInputStreamingStartChunk('tc-1', 'search'),
      toolCallDeltaChunk('tc-1', '{"q":"'),
      toolCallDeltaChunk('tc-1', 'mastra"}'),
      toolCallInputStreamingEndChunk('tc-1'),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({
      state: 'call',
      toolCallId: 'tc-1',
      toolName: 'search',
      args: { q: 'mastra' },
    });
  });

  it('tool-call-input-streaming-end falls back to args: {} when JSON is malformed', () => {
    const out = reduce([
      startChunk(),
      toolCallInputStreamingStartChunk('tc-1', 'search'),
      toolCallDeltaChunk('tc-1', '{"q":'),
      toolCallInputStreamingEndChunk('tc-1'),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({ state: 'call', args: {} });
  });

  it('tool-call after streaming-input chunks upserts into the existing part (no duplicate)', () => {
    const out = reduce([
      startChunk(),
      toolCallInputStreamingStartChunk('tc-1', 'weatherInfo'),
      toolCallDeltaChunk('tc-1', '{"location":"'),
      toolCallDeltaChunk('tc-1', 'Paris"}'),
      toolCallInputStreamingEndChunk('tc-1'),
      toolCallChunk('tc-1', 'weatherInfo', { location: 'Paris, France', _background: null }),
    ]);

    const toolParts = out[0].content.parts.filter(p => p.type === 'tool-invocation') as MastraToolInvocationPart[];
    expect(toolParts).toHaveLength(1);
    expect(toolParts[0].toolInvocation).toMatchObject({
      state: 'call',
      toolCallId: 'tc-1',
      toolName: 'weatherInfo',
      args: { location: 'Paris, France', _background: null },
    });
    expect((toolParts[0] as MastraToolInvocationPart & { argsText?: string }).argsText).toBeUndefined();
  });

  it('tool-call directly after streaming-start (no deltas) still produces one part', () => {
    const out = reduce([
      startChunk(),
      toolCallInputStreamingStartChunk('tc-1', 'search'),
      toolCallChunk('tc-1', 'search', { q: 'mastra' }),
    ]);

    const toolParts = out[0].content.parts.filter(p => p.type === 'tool-invocation') as MastraToolInvocationPart[];
    expect(toolParts).toHaveLength(1);
    expect(toolParts[0].toolInvocation).toMatchObject({
      state: 'call',
      toolCallId: 'tc-1',
      toolName: 'search',
      args: { q: 'mastra' },
    });
  });

  it('tool-call-approval transitions metadata to approval-requested', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'sendMail', { to: 'x' }),
      toolCallApprovalChunk('tc-1', 'sendMail', { to: 'x' }),
    ]);
    expect(out[0].content.metadata).toMatchObject({
      mode: 'stream',
      requireApprovalMetadata: {
        sendMail: { toolCallId: 'tc-1', toolName: 'sendMail', args: { to: 'x' } },
      },
    });
  });

  it('tool-call-suspended records suspendedTools metadata', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'longRun', { x: 1 }),
      toolCallSuspendedChunk('tc-1', 'longRun', { x: 1 }, { reason: 'wait' }),
    ]);
    expect(out[0].content.metadata).toMatchObject({
      mode: 'stream',
      suspendedTools: {
        longRun: {
          toolCallId: 'tc-1',
          toolName: 'longRun',
          args: { x: 1 },
          suspendPayload: { reason: 'wait' },
        },
      },
    });
  });

  it('tool-output appends non-workflow output onto a partial-call result array', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'search', { q: 'x' }),
      toolOutputChunk('tc-1', { from: 'TOOL', payload: 'chunk1' }),
      toolOutputChunk('tc-1', { from: 'TOOL', payload: 'chunk2' }),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation.state).toBe('partial-call');
    expect((toolPart.toolInvocation as { result: unknown[] }).result).toEqual([
      { from: 'TOOL', payload: 'chunk1' },
      { from: 'TOOL', payload: 'chunk2' },
    ]);
  });
});

// =============================================================================
// BACKGROUND TASKS
// =============================================================================

describe('accumulateChunk - background tasks', () => {
  it('background-task-started is a no-op (lifecycle marker)', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([bgTaskStartedChunk('tc-1', 'bg-1')], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('background-task-running records startedAt on the assistant message', () => {
    const startedAt = new Date('2024-01-01T00:00:00Z');
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'longRun', {}),
      bgTaskRunningChunk('tc-1', 'bg-1', startedAt),
    ]);
    const meta = out[0].content.metadata as MastraDBMessageMetadata;
    expect(meta.backgroundTasks?.['tc-1']).toMatchObject<Partial<BackgroundTaskEntry>>({
      taskId: 'bg-1',
      startedAt,
    });
  });

  it('background-task-progress updates runningBackgroundTasksCount', () => {
    const out = reduce([startChunk(), bgTaskProgressChunk(3)]);
    expect(out[0].content.metadata).toMatchObject({ runningBackgroundTasksCount: 3 });
  });

  it('background-task-completed finalizes the tool part as result and clears the running count', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'longRun', {}),
      bgTaskCompletedChunk('tc-1', 'bg-1', { ok: true }),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation.state).toBe('result');
    expect((toolPart.toolInvocation as { result: unknown }).result).toEqual({ ok: true });
    const meta = out[0].content.metadata as MastraDBMessageMetadata;
    expect(meta.runningBackgroundTasksCount).toBeUndefined();
  });

  it('background-task-failed transitions the tool part to output-error', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'longRun', {}),
      bgTaskFailedChunk('tc-1', 'bg-1', 'task failed'),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation).toMatchObject({ state: 'output-error', errorText: 'task failed' });
  });

  it('background-task-cancelled is a no-op (lifecycle marker)', () => {
    const initial = reduce([startChunk(), toolCallChunk('tc-1', 'longRun', {})]);
    const out = reduce([bgTaskCancelledChunk('tc-1', 'bg-1')], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  it('background-task-output appends output to a partial-call result array', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'longRun', {}),
      bgTaskOutputChunk('tc-1', { from: 'TOOL', payload: 'chunk' }),
    ]);
    const toolPart = out[0].content.parts.find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation.state).toBe('partial-call');
    expect((toolPart.toolInvocation as { result: unknown[] }).result).toEqual([{ from: 'TOOL', payload: 'chunk' }]);
  });

  it('background-task-suspended records suspendedTools metadata', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'longRun', { x: 1 }),
      bgTaskSuspendedChunk('tc-1', 'longRun', { x: 1 }, { wait: true }, 'bg-1'),
    ]);
    expect(out[0].content.metadata).toMatchObject({
      mode: 'stream',
      suspendedTools: {
        longRun: { toolCallId: 'tc-1', toolName: 'longRun', suspendPayload: { wait: true } },
      },
    });
  });

  it('background-task-resumed is a no-op (lifecycle marker)', () => {
    const initial = reduce([startChunk(), toolCallChunk('tc-1', 'longRun', {})]);
    const out = reduce([bgTaskResumedChunk('tc-1', 'bg-1')], streamMeta(), initial);
    expect(out).toEqual(initial);
  });
});

// =============================================================================
// CONTENT (source / file / is-task-complete)
// =============================================================================

describe('accumulateChunk - content', () => {
  it('source with sourceType=url appends a source-url part', () => {
    const out = reduce([startChunk(), sourceUrlChunk('s-1', 'https://example.com', 'Example')]);
    const sourcePart = out[0].content.parts.find(p => (p as { type: string }).type === 'source-url');
    expect(sourcePart).toMatchObject({
      type: 'source-url',
      sourceId: 's-1',
      url: 'https://example.com',
      title: 'Example',
    });
  });

  it('source with sourceType=document appends a source-document part', () => {
    const out = reduce([startChunk(), sourceDocumentChunk('d-1', 'application/pdf', 'Report', 'r.pdf')]);
    const sourcePart = out[0].content.parts.find(p => p.type === 'source-document');
    expect(sourcePart).toMatchObject({
      type: 'source-document',
      sourceId: 'd-1',
      mediaType: 'application/pdf',
      title: 'Report',
      filename: 'r.pdf',
    });
  });

  it('file with base64 string data produces a base64 data URL', () => {
    const out = reduce([startChunk(), fileChunkBase64('image/png', 'aGVsbG8=')]);
    const filePart = out[0].content.parts.find(p => p.type === 'file');
    expect(filePart).toMatchObject({
      type: 'file',
      mimeType: 'image/png',
      data: 'data:image/png;base64,aGVsbG8=',
    });
  });

  it('file with plain string data percent-encodes into a data URL', () => {
    const out = reduce([startChunk(), fileChunkPlain('text/plain', 'hello world')]);
    const filePart = out[0].content.parts.find(p => p.type === 'file');
    expect(filePart).toMatchObject({
      type: 'file',
      mimeType: 'text/plain',
      data: 'data:text/plain,hello%20world',
    });
  });

  it('file with large Uint8Array binary data does not overflow the call stack', () => {
    const bytes = new Uint8Array(200_000);
    bytes.fill(0x41);
    const out = reduce([startChunk(), fileChunkBinary('application/octet-stream', bytes)]);
    const filePart = out[0].content.parts.find(p => p.type === 'file');
    const expectedBase64 = Buffer.from(bytes).toString('base64');
    expect(filePart).toMatchObject({
      type: 'file',
      mimeType: 'application/octet-stream',
      data: `data:application/octet-stream;base64,${expectedBase64}`,
    });
  });

  it('is-task-complete emits an assistant feedback message with completionResult', () => {
    const out = reduce([isTaskCompleteChunk(true)]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    expect(out[0].content.metadata).toMatchObject({ completionResult: { passed: true } });
    expect(out[0].content.parts[0].type).toBe('text');
  });

  it('is-task-complete with suppressFeedback returns the conversation unchanged', () => {
    const initial = reduce([startChunk()]);
    const out = reduce([isTaskCompleteChunk(true, true)], streamMeta(), initial);
    expect(out).toEqual(initial);
  });

  // The goal chunk is a consumer-only signal: the core goal step already injects
  // its feedback into the message history, so the accumulator must NOT surface it
  // as its own DB message (unlike is-task-complete).
  it('goal chunk returns the conversation unchanged (no DB message)', () => {
    const initial = reduce([startChunk()]);
    expect(reduce([goalChunk(false)], streamMeta(), initial)).toEqual(initial);
    expect(reduce([goalChunk(true)], streamMeta(), initial)).toEqual(initial);
  });
});

// =============================================================================
// DATA-* CHUNKS
// =============================================================================

describe('accumulateChunk - data-* chunks', () => {
  it('appends opaque data-* parts to the trailing assistant message', () => {
    const out = reduce([startChunk(), dataPartChunk('om-observation', { foo: 'bar' })]);
    const dataPart = out[0].content.parts.find(p => p.type === 'data-om-observation');
    expect(dataPart).toBeDefined();
    expect((dataPart as { data?: unknown }).data).toEqual({ foo: 'bar' });
  });

  it('creates a new assistant message when no trailing assistant exists', () => {
    const out = reduce([dataPartChunk('custom', { v: 1 })]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    expect(out[0].content.parts[0].type).toBe('data-custom');
  });
});

// =============================================================================
// SIGNAL ECHO (data-user-message)
// =============================================================================

describe('accumulateChunk - signal echo (data-user-message)', () => {
  it('finalizes streaming assistant and appends the echoed user message', () => {
    const out = reduce([
      startChunk('asst-1'),
      textStartChunk('t1'),
      textDeltaChunk('t1', 'partial'),
      dataUserMessageChunk('sig-1', 'hello back'),
    ]);

    expect(out).toHaveLength(2);
    const asst = out[0];
    const user = out[1];
    const asstText = asst.content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(asstText.state).toBe('done');
    expect(user.role).toBe('user');
    expect(user.id).toBe('sig-1');
    expect(user.content.parts[0]).toEqual({ type: 'text', text: 'hello back' });
  });

  it('drops an empty trailing assistant before appending the echoed user message', () => {
    const out = reduce([startChunk('asst-1'), dataUserMessageChunk('sig-1', 'hello back')]);

    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('user');
    expect(out[0].id).toBe('sig-1');
    expect(out[0].content.parts[0]).toEqual({ type: 'text', text: 'hello back' });
  });

  it('dedupes by signalId', () => {
    const out = reduce([
      startChunk('asst-1'),
      dataUserMessageChunk('sig-1', 'hello'),
      dataUserMessageChunk('sig-1', 'hello again'),
    ]);
    const userMessages = out.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].id).toBe('sig-1');
  });

  it('reconciles the optimistic message by clientMessageId even when the echoed id differs', () => {
    // Production reality: the optimistic bubble carries a client-generated id
    // (`client-1`), but the server mints and echoes its own signal id
    // (`server-1`). Matching on the `clientMessageId` correlation key keeps the
    // single bubble and adopts the server id.
    const pending = pendingUserMessage('client-1', 'hello', 'corr-1');
    const out = reduce(
      [startChunk('asst-1'), dataUserMessageChunk('server-1', 'hello', 'user', 'corr-1')],
      streamMeta(),
      [pending],
    );

    const userMessages = out.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].id).toBe('server-1');
    expect(userMessages[0].content.metadata?.status).toBeUndefined();
    // The correlation key is retained through reconciliation so the rendered row
    // key stays stable across the id swap (no unmount/remount). It is stripped
    // only later, on reload, by `resolveInitialMessages`.
    expect(userMessages[0].content.metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe('corr-1');
  });

  it('drops the empty assistant shell when reconciling a pending user echo', () => {
    const pending = pendingUserMessage('client-1', 'weather in paris', 'corr-1');
    const out = reduce(
      [startChunk('asst-1'), dataUserMessageChunk('server-1', 'weather in paris', 'user', 'corr-1')],
      streamMeta(),
      [pending],
    );

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'server-1',
      role: 'user',
      content: {
        parts: [{ type: 'text', text: 'weather in paris' }],
      },
    });
  });

  it('reconciled pending bubble keeps echoed binary attachment data', () => {
    const pending: MastraDBMessage = {
      id: 'client-1',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'see this' },
          // Optimistic bubble may start with empty file data before echoed contents merge in.
          { type: 'file', mimeType: 'image/png', data: '' },
        ],
        metadata: { mode: 'stream', status: 'pending', [CLIENT_MESSAGE_ID_KEY]: 'corr-1' },
      },
    };

    const out = reduce(
      [
        dataUserMessageChunk(
          'server-1',
          [
            { type: 'text', text: 'see this' },
            { type: 'file', data: 'data:image/png;base64,abc123', mediaType: 'image/png' },
          ],
          'user',
          'corr-1',
        ),
      ],
      streamMeta(),
      [pending],
    );

    const user = out.find(m => m.role === 'user');
    expect(user?.content.parts).toEqual([
      { type: 'text', text: 'see this' },
      { type: 'file', mimeType: 'image/png', data: 'data:image/png;base64,abc123' },
    ]);
  });

  it('keeps the correlation key but adopts the server id and clears pending on reconciliation', () => {
    // Regression guard for the streaming layout shift: the rendered row key
    // prefers `clientMessageId`, so it must survive the id swap unchanged while
    // the transient pending status is cleared and the server id is adopted.
    const pending = pendingUserMessage('client-1', 'hello', 'corr-1');
    const out = reduce([dataUserMessageChunk('server-1', 'hello', 'user', 'corr-1')], streamMeta(), [pending]);

    const user = out.find(m => m.role === 'user');
    expect(user?.id).toBe('server-1');
    expect(user?.content.metadata?.status).toBeUndefined();
    expect(user?.content.metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe('corr-1');
  });

  it('only resolves the optimistic message whose clientMessageId matches the echo', () => {
    const pendingA = pendingUserMessage('client-1', 'first', 'corr-1');
    const pendingB = pendingUserMessage('client-2', 'second', 'corr-2');
    const out = reduce([dataUserMessageChunk('server-2', 'second', 'user', 'corr-2')], streamMeta(), [
      pendingA,
      pendingB,
    ]);

    const resolved = out.find(m => m.id === 'server-2');
    const stillPending = out.find(m => m.id === 'client-1');
    expect(resolved?.content.metadata?.status).toBeUndefined();
    // Resolved bubble keeps its correlation key for a stable render key.
    expect(resolved?.content.metadata?.[CLIENT_MESSAGE_ID_KEY]).toBe('corr-2');
    expect(stillPending?.content.metadata?.status).toBe('pending');
    expect(out.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('appends an echo that matches no optimistic bubble (foreign/server-injected message)', () => {
    const pending = pendingUserMessage('client-1', 'mine', 'corr-1');
    const out = reduce([dataUserMessageChunk('server-x', 'not mine', 'user', 'corr-other')], streamMeta(), [pending]);

    const userMessages = out.filter(m => m.role === 'user');
    expect(userMessages).toHaveLength(2);
    // The optimistic bubble is untouched and still pending.
    expect(userMessages.find(m => m.id === 'client-1')?.content.metadata?.status).toBe('pending');
  });

  // The server emits the echo with `data.type: 'user'` while the signal input
  // uses `data.type: 'user-message'`. Both must produce a user message; only
  // accepting one of them silently drops the live echo (regression guard).
  it.each(['user', 'user-message'] as const)(
    'converts a data-user-message echo with data.type=%s into a user message',
    dataType => {
      const out = reduce([startChunk('asst-1'), dataUserMessageChunk('sig-1', 'hello back', dataType)]);
      const user = out.find(m => m.role === 'user');
      expect(user).toBeDefined();
      expect(user?.id).toBe('sig-1');
      expect(user?.content.parts[0]).toEqual({ type: 'text', text: 'hello back' });
    },
  );

  it('preserves live signal content part arrays with images', () => {
    const out = reduce([
      startChunk('asst-1'),
      dataUserMessageChunk('sig-1', [
        { type: 'text', text: 'see this' },
        { type: 'file', data: 'data:image/png;base64,abc123', mediaType: 'image/png', filename: 'image.png' },
      ]),
    ]);

    const user = out.find(m => m.role === 'user');
    expect(user?.id).toBe('sig-1');
    expect(user?.content.parts).toEqual([
      { type: 'text', text: 'see this' },
      { type: 'file', mimeType: 'image/png', data: 'data:image/png;base64,abc123', filename: 'image.png' },
    ]);
  });

  it('signal file parts convert to AI SDK UI messages without crashing', () => {
    const out = reduce([
      startChunk('asst-1'),
      dataUserMessageChunk('sig-1', [
        { type: 'text', text: 'have a look at this' },
        { type: 'file', data: 'https://example.com/shot.png', mediaType: 'image/png' },
      ]),
    ]);

    const user = out.find(m => m.role === 'user');
    expect(user).toBeDefined();

    const uiMessages = new MessageList().add([user!], 'memory').get.all.aiV6.ui();
    expect(uiMessages).toHaveLength(1);
    // Issue #19356 expected behavior: the attachment survives conversion as a
    // usable AI SDK UI file part, with the original URL and media type intact.
    expect(uiMessages[0]?.parts.filter(part => part.type === 'file')).toEqual([
      { type: 'file', url: 'https://example.com/shot.png', mediaType: 'image/png' },
    ]);
  });
});

// =============================================================================
// TRIPWIRE
// =============================================================================

describe('accumulateChunk - tripwire', () => {
  it('emits a new assistant message with status=tripwire', () => {
    const out = reduce([tripwireChunk('blocked by guardrail')]);
    expect(out).toHaveLength(1);
    const msg = out[0];
    const text = msg.content.parts.find(p => p.type === 'text');
    expect(text).toMatchObject({ text: 'blocked by guardrail' });
    expect(msg.content.metadata).toMatchObject({
      status: 'tripwire',
      tripwire: {
        reason: 'blocked by guardrail',
        retry: false,
        metadata: { hint: 'blocked' },
        processorId: 'guardrail-1',
      },
    });
  });
});

// =============================================================================
// FINISH / ABORT
// =============================================================================

describe('accumulateChunk - finish / abort finalization', () => {
  it('finish marks streaming text parts done', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'hi'), finishChunk('stop')]);
    const text = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(text.state).toBe('done');
  });

  it('abort marks streaming text parts done', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'hi'), abortChunk()]);
    const text = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(text.state).toBe('done');
  });
});

// =============================================================================
// PASSTHROUGH (workflow / nested-execution / routing / network)
// =============================================================================

describe('accumulateChunk - passthrough chunk families', () => {
  const passthroughTypes = [
    // workflow lifecycle
    'workflow-start',
    'workflow-finish',
    'workflow-canceled',
    'workflow-paused',
    'workflow-step-start',
    'workflow-step-finish',
    'workflow-step-suspended',
    'workflow-step-waiting',
    'workflow-step-output',
    'workflow-step-progress',
    'workflow-step-result',
    // agent-execution
    'agent-execution-start',
    'agent-execution-approval',
    'agent-execution-suspended',
    'agent-execution-end',
    'agent-execution-abort',
    // tool-execution
    'tool-execution-start',
    'tool-execution-end',
    'tool-execution-approval',
    'tool-execution-suspended',
    'tool-execution-abort',
    // routing-agent
    'routing-agent-start',
    'routing-agent-text-delta',
    'routing-agent-text-start',
    'routing-agent-end',
    'routing-agent-abort',
    // workflow-execution
    'workflow-execution-start',
    'workflow-execution-end',
    'workflow-execution-suspended',
    'workflow-execution-abort',
    // network
    'network-execution-event-step-finish',
    'network-execution-event-finish',
    'network-validation-start',
    'network-validation-end',
    'network-object',
    'network-object-result',
    // template-literal passthroughs
    'agent-execution-event-foo',
    'workflow-execution-event-bar',
  ];

  it.each(passthroughTypes)('%s returns the conversation unchanged', type => {
    const initial = reduce([startChunk()]);
    const out = reduce([passthroughChunk(type)], streamMeta(), initial);
    expect(out).toEqual(initial);
  });
});

// =============================================================================
// finishStreamingAssistantMessage helper
// =============================================================================

describe('finishStreamingAssistantMessage', () => {
  it('marks streaming text on the trailing assistant message as done', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'hi')]);
    const finished = finishStreamingAssistantMessage(out);
    const text = finished[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(text.state).toBe('done');
  });

  it('is a no-op when there is no trailing assistant', () => {
    const userOnly: MastraDBMessage[] = [
      {
        id: 'u-1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
      },
    ];
    expect(finishStreamingAssistantMessage(userOnly)).toBe(userOnly);
  });

  it('drops an empty trailing assistant message', () => {
    const out = reduce([startChunk('asst-1')]);
    expect(finishStreamingAssistantMessage(out)).toEqual([]);
  });
});

// =============================================================================
// WORKFLOW TOOL FINISH — REGRESSION
// =============================================================================
//
// A workflow tool's accumulated `WorkflowStreamResult` (built up by
// `tool-output` chunks via `mapWorkflowStreamChunkToWatchResult`) must survive
// the terminal `tool-result` chunk, even when that terminal payload is a bare
// scalar like `{ result: 'suh' }` with no `steps` field. The previous heuristic
// detected workflows purely by `payload.result.steps`, so dynamic-workflow
// finishes would clobber the accumulated step history and reset the UI.

describe('accumulateChunk - workflow tool finish', () => {
  const workflowOutputChunk = (toolCallId: string, type: string, payload: Record<string, unknown>): ChunkType =>
    toolOutputChunk(toolCallId, { type, runId: RUN_ID, from: 'AGENT', payload });

  it('preserves accumulated workflow steps when tool-result payload omits steps', () => {
    const out = reduce([
      startChunk(),
      toolCallChunk('wf-1', 'workflow-myWorkflow', { foo: 'bar' }),
      // Build up a WorkflowStreamResult via tool-output chunks
      workflowOutputChunk('wf-1', 'workflow-start', { runId: RUN_ID }),
      workflowOutputChunk('wf-1', 'workflow-step-start', { id: 'step-a' }),
      workflowOutputChunk('wf-1', 'workflow-step-result', {
        id: 'step-a',
        status: 'success',
        output: { value: 1 },
      }),
      workflowOutputChunk('wf-1', 'workflow-finish', {
        runId: RUN_ID,
        workflowStatus: 'success',
      }),
      // Terminal tool-result: bare scalar, no `steps` field
      toolResultChunk('wf-1', { result: 'suh', runId: RUN_ID }),
    ]);

    const toolPart = out
      .flatMap(m => m.content.parts)
      .find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation.state).toBe('result');
    const result = (toolPart.toolInvocation as { result: Record<string, unknown> }).result;
    // Accumulated step history is preserved
    expect(result.steps).toBeDefined();
    expect(Object.keys(result.steps as Record<string, unknown>)).toContain('step-a');
    expect((result.steps as Record<string, { status: string }>)['step-a'].status).toBe('success');
    // Final status from the accumulated workflow stays
    expect(result.status).toBe('success');
    // Terminal scalar payload is still surfaced for downstream renderers
    expect(result.output).toEqual({ result: 'suh', runId: RUN_ID });
  });

  it('detects workflow tools by toolName prefix even with no prior tool-output', () => {
    // No tool-output chunks at all: only the tool-call + a bare tool-result
    // whose `result` is a scalar string. With no prior accumulated workflow
    // state and no workflow-shaped payload, the accumulator simply passes the
    // raw payload through (it has nothing to merge), but it must still mark
    // the part as `result`.
    const out = reduce([
      startChunk(),
      toolCallChunk('wf-1', 'workflow-myWorkflow', { foo: 'bar' }),
      toolResultChunk('wf-1', { result: 'suh', runId: RUN_ID }),
    ]);

    const toolPart = out
      .flatMap(m => m.content.parts)
      .find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation.state).toBe('result');
    expect((toolPart.toolInvocation as { result: unknown }).result).toEqual({
      result: 'suh',
      runId: RUN_ID,
    });
  });

  it('non-workflow tool-result still overwrites cleanly (no leakage)', () => {
    // Guard against the broadened heuristic leaking into agent/plain tools.
    const out = reduce([
      startChunk(),
      toolCallChunk('tc-1', 'search', { q: 'mastra' }),
      toolResultChunk('tc-1', { hits: 3 }),
    ]);
    const toolPart = out
      .flatMap(m => m.content.parts)
      .find(p => p.type === 'tool-invocation') as MastraToolInvocationPart;
    expect(toolPart.toolInvocation.state).toBe('result');
    // Plain scalar payload is preserved, no `steps`/`status`/`output` wrapper
    expect((toolPart.toolInvocation as { result: unknown }).result).toEqual({ hits: 3 });
  });
});
