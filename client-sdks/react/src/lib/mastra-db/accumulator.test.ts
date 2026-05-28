import type { MastraDBMessage, MastraToolInvocationPart } from '@mastra/core/agent/message-list';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { accumulateChunk, finishStreamingAssistantMessage } from './accumulator';
import type { MastraDBMessageMetadata, MastraTextPart } from './types';

const RUN_ID = 'run-1';

const streamMeta = (): MastraDBMessageMetadata => ({ mode: 'stream' });

const startChunk = (messageId = 'asst-1'): ChunkType =>
  ({
    type: 'start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { messageId },
  }) as unknown as ChunkType;

const textStartChunk = (id: string): ChunkType =>
  ({
    type: 'text-start',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { id },
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

const toolCallChunk = (toolCallId: string, toolName: string, args: Record<string, unknown>): ChunkType =>
  ({
    type: 'tool-call',
    runId: RUN_ID,
    from: 'AGENT',
    payload: { toolCallId, toolName, args },
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

const dataUserMessageChunk = (id: string, contents: unknown): ChunkType =>
  ({
    type: 'data-user-message',
    runId: RUN_ID,
    from: 'AGENT',
    data: { type: 'user-message', id, contents },
  }) as unknown as ChunkType;

const reduce = (
  chunks: ChunkType[],
  metadata: MastraDBMessageMetadata = streamMeta(),
  initial: MastraDBMessage[] = [],
): MastraDBMessage[] => chunks.reduce((conv, chunk) => accumulateChunk({ chunk, conversation: conv, metadata }), initial);

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
});

describe('accumulateChunk - text streaming', () => {
  it('text-start → text-delta accumulates by textId', () => {
    const out = reduce([startChunk(), textStartChunk('t1'), textDeltaChunk('t1', 'Hel'), textDeltaChunk('t1', 'lo')]);
    expect(out).toHaveLength(1);
    const textPart = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(textPart.text).toBe('Hello');
    expect(textPart.state).toBe('streaming');
    expect(textPart.textId).toBe('t1');
  });

  it('text-end is a no-op on lifecycle (final state set by finish)', () => {
    const out = reduce([
      startChunk(),
      textStartChunk('t1'),
      textDeltaChunk('t1', 'hi'),
      textEndChunk('t1'),
    ]);
    const textPart = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(textPart.text).toBe('hi');
  });

  it('text-delta without prior assistant creates one', () => {
    const out = reduce([textDeltaChunk('t1', 'orphan')]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    const textPart = out[0].content.parts.find(p => p.type === 'text') as MastraTextPart;
    expect(textPart.text).toBe('orphan');
  });
});

describe('accumulateChunk - tool lifecycle', () => {
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

  it('tool-call without prior assistant creates one', () => {
    const out = reduce([toolCallChunk('tc-1', 'search', { q: 'x' })]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('assistant');
    expect(out[0].content.parts[0]).toMatchObject({ type: 'tool-invocation' });
  });
});

describe('accumulateChunk - data parts', () => {
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
});

describe('accumulateChunk - tripwire', () => {
  it('emits a new assistant message with status=tripwire', () => {
    const out = reduce([tripwireChunk('blocked by guardrail')]);
    expect(out).toHaveLength(1);
    const msg = out[0];
    const text = msg.content.parts.find(p => p.type === 'text');
    expect(text).toMatchObject({ text: 'blocked by guardrail' });
    expect(msg.content.metadata).toMatchObject({
      status: 'tripwire',
      tripwire: { retry: false, tripwirePayload: { hint: 'blocked' }, processorId: 'guardrail-1' },
    });
  });
});

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
});
