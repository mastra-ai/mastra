import { describe, expect, it } from 'vitest';
import { buildSpanInputPreview, buildSpanOutputPreview } from './span-preview';
import { SpanType } from './types';

describe('native span previews', () => {
  it.each(['[1] cited answer', '{not JSON}', '"quoted"'])('preserves literal text %s', input => {
    expect(buildSpanInputPreview({ spanType: SpanType.AGENT_RUN, input }).value).toBe(input);
    expect(buildSpanOutputPreview({ spanType: SpanType.TOOL_CALL, output: input }).value).toBe(input);
  });

  it('selects user text from messages', () => {
    expect(
      buildSpanInputPreview({
        spanType: SpanType.AGENT_RUN,
        input: {
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'question' }, { type: 'image' }] },
            { role: 'assistant', content: 'answer' },
          ],
        },
      }),
    ).toEqual({ value: 'question', truncated: false });
  });

  it.each([SpanType.AGENT_RUN, SpanType.MODEL_GENERATION, SpanType.MODEL_INFERENCE])(
    'extracts model result text for %s',
    spanType => {
      expect(buildSpanOutputPreview({ spanType, output: { text: 'answer', object: { extra: true } } }).value).toBe(
        'answer',
      );
    },
  );

  it('preserves JSON for tool output and resumed agent input', () => {
    expect(buildSpanOutputPreview({ spanType: SpanType.TOOL_CALL, output: { result: 1 } }).value).toBe('{"result":1}');
    expect(
      buildSpanInputPreview({
        spanType: SpanType.AGENT_RUN,
        input: { resumeData: { approved: true } },
        metadata: { resumed: true },
      }).value,
    ).toBe('{"resumeData":{"approved":true}}');
  });

  it('distinguishes recorded interruption output from absent output', () => {
    expect(buildSpanOutputPreview({ spanType: SpanType.AGENT_RUN, output: { status: 'suspended' } }).value).toBe(
      'suspended',
    );
    expect(buildSpanOutputPreview({ spanType: SpanType.WORKFLOW_RUN, attributes: { status: 'suspended' } })).toEqual({
      value: null,
      truncated: false,
    });
  });

  it('bounds Unicode by code points and reports truncation separately', () => {
    const output = '😀'.repeat(256);
    expect(buildSpanOutputPreview({ spanType: SpanType.TOOL_CALL, output })).toEqual({
      value: output,
      truncated: false,
    });
    expect(buildSpanOutputPreview({ spanType: SpanType.TOOL_CALL, output: output + 'x' })).toEqual({
      value: output,
      truncated: true,
    });
  });
});
