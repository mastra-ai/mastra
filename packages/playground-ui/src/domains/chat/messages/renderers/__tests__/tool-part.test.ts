import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react';
import { describe, expect, it } from 'vitest';

import { isToolPart, readToolPart } from '../tool-part';

const invocation = (fields: Partial<ToolInvocationPart['toolInvocation']>): ToolInvocationPart =>
  ({
    type: 'tool-invocation',
    toolInvocation: { toolName: 'view', toolCallId: 'call-1', state: 'call', ...fields },
  }) as never;

describe('readToolPart', () => {
  describe('when a legacy result carries protocol error metadata', () => {
    it.each([
      { isError: true, state: 'output-error' },
      { isError: false, state: 'result' },
      { isError: undefined, state: 'result' },
    ])('uses the explicit $isError flag rather than interpreting result fields', ({ isError, state }) => {
      const part = invocation({ state: 'result', args: {}, result: { success: false, isError: true } });
      const marked = { ...part, toolInvocation: { ...part.toolInvocation, isError } };
      expect(readToolPart(marked)).toMatchObject({ state, output: { success: false, isError: true } });
    });
  });

  describe('when a legacy call has not produced a result', () => {
    it('does not promote an error marker to a terminal outcome', () => {
      const part = invocation({ state: 'call', args: {} });
      const marked = { ...part, toolInvocation: { ...part.toolInvocation, isError: true } };
      expect(readToolPart(marked).state).toBe('call');
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
