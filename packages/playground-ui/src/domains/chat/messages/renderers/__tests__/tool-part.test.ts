import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react';
import { describe, expect, it } from 'vitest';

import { isToolPart, readToolPart } from '../tool-part';

const invocation = (fields: Partial<ToolInvocationPart['toolInvocation']>): ToolInvocationPart =>
  ({
    type: 'tool-invocation',
    toolInvocation: { toolName: 'view', toolCallId: 'call-1', state: 'call', ...fields },
  }) as never;

describe('readToolPart', () => {
  describe('when a delegation fails after producing partial output', () => {
    it.each([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'agent-head',
          toolCallId: 'failed-call',
          state: 'output-error',
          args: {},
          result: { text: 'Partial research' },
          errorText: 'Delegation failed',
        },
      },
      {
        type: 'dynamic-tool',
        toolName: 'agent-head',
        toolCallId: 'failed-call',
        state: 'output-error',
        input: {},
        output: { text: 'Partial research' },
        errorText: 'Delegation failed',
      },
    ] satisfies MessageFactoryPart[])('preserves the error and output from $type', part => {
      expect(isToolPart(part)).toBe(true);
      if (!isToolPart(part)) throw new Error('Expected a tool part');
      expect(readToolPart(part)).toMatchObject({
        toolName: 'agent-head',
        state: 'output-error',
        errorText: 'Delegation failed',
        output: { text: 'Partial research' },
      });
    });
  });

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
