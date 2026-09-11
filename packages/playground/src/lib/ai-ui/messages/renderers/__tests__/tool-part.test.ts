import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react';
import { describe, expect, it } from 'vitest';

import { isToolPart, readToolPart } from '../tool-part';

const invocation = (fields: Partial<ToolInvocationPart['toolInvocation']>): ToolInvocationPart =>
  ({
    type: 'tool-invocation',
    toolInvocation: { toolName: 'view', toolCallId: 'call-1', state: 'call', ...fields },
  }) as never;

describe('readToolPart', () => {
  it('reads a persisted v4 invocation as input and output', () => {
    expect(readToolPart(invocation({ state: 'result', args: { path: 'a.ts' }, result: { ok: true } }))).toEqual({
      toolName: 'view',
      toolCallId: 'call-1',
      state: 'result',
      input: { path: 'a.ts' },
      output: { ok: true },
    });
  });

  it('leaves input and output undefined while a v4 call has neither yet', () => {
    expect(readToolPart(invocation({ state: 'partial-call' }))).toMatchObject({ input: undefined, output: undefined });
  });

  it('reads a streamed v5 dynamic part as is', () => {
    expect(
      readToolPart({
        type: 'dynamic-tool',
        toolName: 'view',
        toolCallId: 'call-2',
        state: 'output-available',
        input: 1,
        output: 2,
      }),
    ).toEqual({ toolName: 'view', toolCallId: 'call-2', state: 'output-available', input: 1, output: 2 });
  });

  describe('when a persisted tool result has model output metadata', () => {
    it('includes the model output used by the assistant', () => {
      const part: ToolInvocationPart = {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'createImage',
          toolCallId: 'call-image',
          state: 'result',
          args: {},
          result: { data: [] },
        },
        providerMetadata: {
          mastra: { modelOutput: { type: 'content', value: [{ type: 'media', data: 'image-data' }] } },
        },
      };

      expect(readToolPart(part).modelOutput).toEqual({
        type: 'content',
        value: [{ type: 'media', data: 'image-data' }],
      });
    });
  });

  describe('when a streamed tool result has separate call and result metadata', () => {
    it('uses the result model output', () => {
      const part = Object.assign(
        {
          type: 'dynamic-tool' as const,
          toolName: 'createImage',
          toolCallId: 'call-image',
          state: 'output-available',
          input: {},
          output: { data: [] },
        },
        {
          callProviderMetadata: { mastra: { modelOutput: { type: 'text', value: 'calling' } } },
          resultProviderMetadata: { mastra: { modelOutput: { type: 'text', value: 'complete' } } },
        },
      );

      expect(readToolPart(part).modelOutput).toEqual({ type: 'text', value: 'complete' });
    });
  });

  describe('when tool result metadata has no Mastra metadata object', () => {
    it('does not expose model output', () => {
      const emptyMetadata: unknown = JSON.parse('null');
      const part = Object.assign(
        {
          type: 'dynamic-tool' as const,
          toolName: 'createImage',
          toolCallId: 'call-image',
          state: 'output-available',
          input: {},
          output: { data: [] },
        },
        { resultProviderMetadata: { mastra: emptyMetadata } },
      );

      expect(readToolPart(part).modelOutput).toBeUndefined();
    });
  });

  it('names a typed v5 part after its type when it carries no tool name, and gives it an empty id', () => {
    expect(readToolPart({ type: 'tool-search', input: {} })).toMatchObject({ toolName: 'search', toolCallId: '' });
  });
});

describe('isToolPart', () => {
  it('accepts every tool part shape and nothing else', () => {
    const parts: MessageFactoryPart[] = [
      invocation({}),
      { type: 'dynamic-tool', toolName: 'view' },
      { type: 'tool-search' },
      { type: 'text', text: 'hi' },
      { type: 'step-start' },
    ];
    expect(parts.map(isToolPart)).toEqual([true, true, true, false, false]);
  });
});
