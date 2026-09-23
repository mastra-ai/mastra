import { describe, expect, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import {
  describeProcessorPhase,
  describeProcessorPipeline,
  describeSpanError,
  describeSpanInput,
  describeSpanOutput,
  isSpanRecordOfType,
} from './span-record';
import { SpanType } from './types';

describe('isSpanRecordOfType', () => {
  const record = (spanType: SpanType, attributes: Record<string, unknown> = {}): SpanRecord =>
    ({ traceId: 't', spanId: 's', spanType, attributes }) as unknown as SpanRecord;

  it('matches a single span type', () => {
    expect(isSpanRecordOfType(record(SpanType.MODEL_GENERATION), SpanType.MODEL_GENERATION)).toBe(true);
    expect(isSpanRecordOfType(record(SpanType.AGENT_RUN), SpanType.MODEL_GENERATION)).toBe(false);
  });

  it('matches any span type in a list', () => {
    const modelTypes = [SpanType.MODEL_GENERATION, SpanType.MODEL_STEP] as const;

    expect(isSpanRecordOfType(record(SpanType.MODEL_STEP), modelTypes)).toBe(true);
    expect(isSpanRecordOfType(record(SpanType.TOOL_CALL), modelTypes)).toBe(false);
    expect(isSpanRecordOfType(record(SpanType.TOOL_CALL), [])).toBe(false);
  });

  it('reads the typed payload of the narrowed record', () => {
    const span = record(SpanType.MODEL_GENERATION, { usage: { inputTokens: 1 } });

    if (isSpanRecordOfType(span, SpanType.MODEL_GENERATION)) {
      expect(span.attributes?.usage?.inputTokens).toBe(1);
    } else {
      expect.unreachable('span should narrow to MODEL_GENERATION');
    }
  });
});

const span = (spanType: SpanType, fields: Partial<SpanRecord> = {}): SpanRecord =>
  ({ traceId: 't', spanId: 's', spanType, ...fields }) as unknown as SpanRecord;

describe('describeSpanInput', () => {
  it('is empty when the span recorded no input', () => {
    expect(describeSpanInput(span(SpanType.AGENT_RUN))).toBeUndefined();
    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: null }))).toBeUndefined();
  });

  it('tags a prompt string as text', () => {
    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: 'hi' }))).toEqual({ type: 'text', value: 'hi' });
  });

  it('tags a message list, unwrapping the { messages } envelope', () => {
    const messages = [{ role: 'user', content: 'hi' }];

    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: messages }))).toEqual({
      type: 'messages',
      value: messages,
    });
    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: { messages } }))).toEqual({
      type: 'messages',
      value: messages,
    });
    expect(describeSpanInput(span(SpanType.MODEL_GENERATION, { input: { messages } }))).toEqual({
      type: 'messages',
      value: messages,
    });
    expect(describeSpanInput(span(SpanType.MODEL_STEP, { input: messages }))).toEqual({
      type: 'messages',
      value: messages,
    });
  });

  it('wraps a single message object and a string envelope', () => {
    const message = { role: 'user', content: 'hi' };

    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: message }))).toEqual({
      type: 'messages',
      value: [message],
    });
    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: { messages: 'hi' } }))).toEqual({
      type: 'text',
      value: 'hi',
    });
  });

  it('tags the resume data of a resumed agent run', () => {
    const resume = { approved: true, toolName: 'deleteTool', toolCallId: 'call_1' };

    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: resume }))).toEqual({
      type: 'agent-run-resume',
      value: resume,
    });
    // Older rows carry the resumed flag in metadata but no tool identity in the input.
    expect(
      describeSpanInput(span(SpanType.AGENT_RUN, { input: { approved: true }, metadata: { resumed: true } })),
    ).toEqual({
      type: 'agent-run-resume',
      value: { approved: true },
    });
  });

  it('tags a resumed run by its marker, whatever shape the resume data has', () => {
    const resumed = { metadata: { resumed: true } };
    const tag = (input: unknown) => describeSpanInput(span(SpanType.AGENT_RUN, { input, ...resumed }));

    // Resume data that happens to carry `messages` is still resume data.
    expect(tag({ messages: ['approved'] })).toEqual({ type: 'agent-run-resume', value: { messages: ['approved'] } });
    expect(tag({ resumeData: 'Yes' })).toEqual({ type: 'agent-run-resume', value: { resumeData: 'Yes' } });

    // Runs resumed before core always recorded an object can hold a bare value.
    expect(tag('Yes')).toEqual({ type: 'agent-run-resume', value: { resumeData: 'Yes' } });
    expect(tag(['approved'])).toEqual({ type: 'agent-run-resume', value: { resumeData: ['approved'] } });
    expect(tag(42)).toEqual({ type: 'agent-run-resume', value: { resumeData: 42 } });
    expect(tag(false)).toEqual({ type: 'agent-run-resume', value: { resumeData: false } });

    // A span that recorded no input stays empty, as it does for every span type.
    expect(tag(null)).toBeUndefined();

    // Without the marker, a `{ messages }` envelope is still a message list.
    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: { messages: ['approved'] } }))).toEqual({
      type: 'messages',
      value: ['approved'],
    });
    // The marker only speaks for agent runs; a tool call's string input is still text.
    expect(describeSpanInput(span(SpanType.TOOL_CALL, { input: 'Yes', ...resumed }))).toEqual({
      type: 'text',
      value: 'Yes',
    });
  });

  it('keeps caller-defined payloads as json, even when they are arrays', () => {
    expect(describeSpanInput(span(SpanType.TOOL_CALL, { input: { city: 'Paris' } }))).toEqual({
      type: 'json',
      value: { city: 'Paris' },
    });
    expect(describeSpanInput(span(SpanType.TOOL_CALL, { input: [1, 2] }))).toEqual({ type: 'json', value: [1, 2] });
    expect(describeSpanInput(span(SpanType.WORKFLOW_STEP, { input: 42 }))).toEqual({ type: 'json', value: 42 });
    expect(describeSpanInput(span(SpanType.AGENT_RUN, { input: { unknownKey: 1 } }))).toEqual({
      type: 'json',
      value: { unknownKey: 1 },
    });
  });
});

describe('describeSpanOutput', () => {
  it('is empty when the span recorded no output', () => {
    expect(describeSpanOutput(span(SpanType.AGENT_RUN))).toBeUndefined();
  });

  it('tags an interrupted run before the result type', () => {
    const suspended = {
      status: 'suspended',
      reason: 'tool-call-approval',
      toolName: 'deleteTool',
      toolCallId: 'call_1',
    };
    const aborted = { status: 'aborted', reason: 'abort' };

    expect(describeSpanOutput(span(SpanType.AGENT_RUN, { output: suspended }))).toEqual({
      type: 'interrupted',
      value: suspended,
    });
    expect(describeSpanOutput(span(SpanType.AGENT_RUN, { output: aborted }))).toEqual({
      type: 'interrupted',
      value: aborted,
    });
    expect(describeSpanOutput(span(SpanType.MODEL_GENERATION, { output: suspended }))).toEqual({
      type: 'interrupted',
      value: suspended,
    });
    expect(describeSpanOutput(span(SpanType.MODEL_STEP, { output: suspended }))).toEqual({
      type: 'interrupted',
      value: suspended,
    });
  });

  it('tags each result by the span type that recorded it', () => {
    const result = { text: 'hello', toolCalls: [] };

    expect(describeSpanOutput(span(SpanType.AGENT_RUN, { output: result }))).toEqual({
      type: 'agent-run-result',
      value: result,
    });
    expect(describeSpanOutput(span(SpanType.MODEL_GENERATION, { output: result }))).toEqual({
      type: 'model-generation-result',
      value: result,
    });
    expect(describeSpanOutput(span(SpanType.MODEL_STEP, { output: result }))).toEqual({
      type: 'model-step-result',
      value: result,
    });
    expect(describeSpanOutput(span(SpanType.MODEL_INFERENCE, { output: result }))).toEqual({
      type: 'model-step-result',
      value: result,
    });
  });

  it('never reads an inference span as interrupted', () => {
    const suspended = { status: 'suspended' };

    expect(describeSpanOutput(span(SpanType.MODEL_INFERENCE, { output: suspended }))).toEqual({
      type: 'model-step-result',
      value: suspended,
    });
  });

  it('tags strings as text and everything else as json', () => {
    expect(describeSpanOutput(span(SpanType.GENERIC, { output: 'done' }))).toEqual({ type: 'text', value: 'done' });
    expect(describeSpanOutput(span(SpanType.TOOL_CALL, { output: { tempC: 15 } }))).toEqual({
      type: 'json',
      value: { tempC: 15 },
    });
    expect(describeSpanOutput(span(SpanType.WORKFLOW_RUN, { output: [1] }))).toEqual({ type: 'json', value: [1] });
  });
});

describe('describeSpanError', () => {
  it('returns the typed error info only when a message is present', () => {
    const error = { message: 'boom', name: 'TypeError' };

    expect(describeSpanError(span(SpanType.TOOL_CALL, { error }))).toEqual(error);
    expect(describeSpanError(span(SpanType.TOOL_CALL, { error: null }))).toBeUndefined();
    expect(describeSpanError(span(SpanType.TOOL_CALL, { error: { name: 'x' } }))).toBeUndefined();
    expect(describeSpanError(span(SpanType.TOOL_CALL, { error: 'boom' }))).toBeUndefined();
  });
});

describe('processor span descriptions', () => {
  const processorSpan = (
    attributes: Record<string, unknown>,
    fields: Partial<SpanRecord> = {},
    spanType: SpanType = SpanType.PROCESSOR_RUN,
  ): SpanRecord => span(spanType, { attributes, ...fields } as Partial<SpanRecord>);

  it('describes a payload by the phase the span recorded', () => {
    const description = describeSpanInput(
      processorSpan({ processorPhase: 'toolResult' }, { input: { toolName: 'search', toolCallId: 'call_1' } }),
    );

    expect(description).toEqual({
      type: 'processor',
      value: {
        phase: 'toolResult',
        phaseLabel: 'Tool result',
        data: { toolName: 'search', toolCallId: 'call_1' },
      },
    });
  });

  it('separates the two output hooks, which share one declaration phase', () => {
    const stream = describeSpanOutput(
      processorSpan({ processorPhase: 'outputStream' }, { output: { totalChunks: 12, accumulatedText: 'hi' } }),
    );
    const result = describeSpanOutput(processorSpan({ processorPhase: 'outputResult' }, { output: { messages: [] } }));

    expect(stream?.type === 'processor' && stream.value.phase).toBe('outputStream');
    expect(result?.type === 'processor' && result.value.phase).toBe('outputResult');
  });

  it('describes a processor that retyped its span', () => {
    const description = describeSpanInput(
      processorSpan(
        { processorPhase: 'input', operation: 'inject' },
        { input: { messages: [] } },
        SpanType.SKILL_ACTION,
      ),
    );

    expect(description?.type).toBe('processor');
  });

  it('falls back to JSON for a span stored before the phase was recorded', () => {
    const description = describeSpanInput(processorSpan({ processorIndex: 0 }, { input: { messages: [] } }));

    expect(description?.type).toBe('json');
  });

  it('keeps an empty processor payload as JSON', () => {
    const description = describeSpanOutput(processorSpan({ processorPhase: 'input' }, { output: {} }));

    expect(description).toEqual({ type: 'json', value: {} });
  });

  it('ignores a phase it does not know', () => {
    expect(describeProcessorPhase(processorSpan({ processorPhase: 'someFuturePhase' }))).toBeUndefined();
  });

  it('splits runner-owned attributes from everything else', () => {
    const description = describeProcessorPipeline(
      processorSpan({
        processorPhase: 'output',
        processorExecutor: 'workflow',
        processorIndex: 2,
        hookDurationMs: 18.5,
        tripwireAbort: { reason: 'blocked', retry: false },
        operation: 'inject',
      }),
    );

    expect(description).toBeUndefined();
  });

  it('keeps unknown attributes apart from the ones it explains', () => {
    const description = describeProcessorPipeline(
      processorSpan({
        processorPhase: 'outputResult',
        processorExecutor: 'workflow',
        processorIndex: 2,
        hookDurationMs: 18.5,
        messageListMutations: [{ type: 'addSystem', tag: 'memory' }],
        tripwireAbort: { reason: 'blocked', retry: false },
        operation: 'inject',
      }),
    );

    expect(description).toMatchObject({
      phase: 'outputResult',
      phaseLabel: 'Output result',
      executor: 'workflow',
      processorIndex: 2,
      hookDurationMs: 18.5,
      tripwireAbort: { reason: 'blocked' },
      rest: { operation: 'inject' },
    });
    expect(description?.rest).not.toHaveProperty('processorPhase');
    expect(description?.rest).not.toHaveProperty('messageListMutations');
  });

  it('omits rest when every attribute is accounted for', () => {
    const description = describeProcessorPipeline(processorSpan({ processorPhase: 'input', processorIndex: 0 }));

    expect(description?.rest).toBeUndefined();
  });
  it.each([
    ['input', { messages: [] }, { systemMessages: [] }],
    ['inputStep', { messages: [], stepNumber: 1, model: { modelId: 'test' } }, { retryCount: 1 }],
    ['outputResult', { messages: [], result: { text: 'done' } }, { messages: [] }],
    ['outputStep', { messages: [], toolCalls: [] }, { systemMessages: [] }],
    ['outputStream', { totalChunks: 0 }, { totalChunks: 0, accumulatedText: '' }],
    ['toolResult', { toolName: 'search', providerExecuted: false }, { messages: [] }],
    ['llmRequest', { prompt: [{ role: 'user', content: 'hello' }] }, { messages: [] }],
    ['llmResponse', { fromCache: false, chunkCount: 0 }, { messages: [] }],
    ['requestError', { messages: [], error: 'Request failed' }, { messages: [] }],
  ])('describes the recorded %s input and output without changing either payload', (phase, input, output) => {
    const record = processorSpan({ processorPhase: phase }, { input, output });
    const inputDescription = describeSpanInput(record);
    const outputDescription = describeSpanOutput(record);
    expect(inputDescription).toMatchObject({ type: 'processor', value: { phase, data: input } });
    expect(outputDescription).toMatchObject({ type: 'processor', value: { phase, data: output } });
    if (inputDescription?.type === 'processor') expect(inputDescription.value.data).toBe(input);
    if (outputDescription?.type === 'processor') expect(outputDescription.value.data).toBe(output);
  });

  it.each(['toString', '__proto__', 'constructor', null, {}, 2])('rejects an invalid phase %j', phase => {
    const record = processorSpan({ processorPhase: phase }, { input: { messages: [] }, output: {} });
    expect(describeProcessorPhase(record)).toBeUndefined();
    expect(describeProcessorPipeline(record)).toBeUndefined();
    expect(describeSpanInput(record)?.type).toBe('json');
    expect(describeSpanOutput(record)?.type).toBe('json');
  });

  it('preserves custom fields and arbitrary mutation message contents', () => {
    const message = { customMessage: true };
    const input = { messages: [], customPayload: { important: true } };
    const record = processorSpan(
      { processorPhase: 'input', messageListMutations: [{ type: 'addSystem', message }] },
      { input },
    );
    expect(describeSpanInput(record)).toMatchObject({ type: 'processor', value: { data: input } });
    expect(describeProcessorPipeline(record)?.messageListMutations?.[0]?.message).toBe(message);
  });
});
