import { describe, expect, it } from 'vitest';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { describeSpanError, describeSpanInput, describeSpanOutput, isSpanRecordOfType } from './span-record';
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
