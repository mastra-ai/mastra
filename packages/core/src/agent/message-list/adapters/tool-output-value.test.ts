import { describe, expect, it } from 'vitest';

import type { MastraDBMessage, MastraToolInvocationPart } from '../state/types';
import type { AIV5Type, AIV6Type } from '../types';
import { AIV5Adapter } from './AIV5Adapter';
import { AIV6Adapter } from './AIV6Adapter';

const output = { value: 42, receipt: 'r-1' };

function expectStoredOutput(message: MastraDBMessage, expectedOutput: unknown = output) {
  expect(message.content.toolInvocations?.[0]?.result).toEqual(expectedOutput);

  const part = message.content.parts.find(
    (candidate): candidate is MastraToolInvocationPart => candidate.type === 'tool-invocation',
  );
  expect(part?.toolInvocation).toMatchObject({ state: 'result', result: expectedOutput });
}

describe('UI tool output containing a value key', () => {
  it('preserves sibling fields when AIV5Adapter stores the output', () => {
    const message: AIV5Type.UIMessage = {
      id: 'msg-v5',
      role: 'assistant',
      parts: [
        {
          type: 'tool-lookup',
          toolCallId: 'call-v5',
          state: 'output-available',
          input: {},
          output,
        },
      ],
    };

    expectStoredOutput(AIV5Adapter.fromUIMessage(message));
  });

  it('preserves sibling fields when AIV6Adapter stores the output', () => {
    const toolPart: AIV6Type.ToolUIPart = {
      type: 'tool-lookup',
      toolCallId: 'call-v6',
      state: 'output-available',
      input: {},
      output,
    };
    const message: AIV6Type.UIMessage = {
      id: 'msg-v6',
      role: 'assistant',
      parts: [toolPart],
    };

    expectStoredOutput(AIV6Adapter.fromUIMessage(message));
  });
});

describe('AIV5 model tool output containing a value key', () => {
  function fromModelMessage(toolOutput: AIV5Type.ToolResultPart['output']) {
    return AIV5Adapter.fromModelMessage({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-v5',
          toolName: 'lookup',
          output: toolOutput,
        },
      ],
    });
  }

  it('preserves sibling fields', () => {
    expectStoredOutput(fromModelMessage(output), output);
  });

  it.each([0, false, '', null])('unwraps a legacy sole-key envelope containing %#', value => {
    expectStoredOutput(fromModelMessage({ value }), value);
  });

  it.each([
    ['error-text', 'failed'],
    ['error-json', { code: 'E_FAIL' }],
  ] as const)('stores a documented %s wrapper as an errored invocation', (type, value) => {
    const message = fromModelMessage({ type, value });
    const errorText = typeof value === 'string' ? value : JSON.stringify(value);

    expect(message.content.toolInvocations?.[0]).toMatchObject({
      state: 'output-error',
      result: value,
      errorText,
    });

    const part = message.content.parts.find(
      (candidate): candidate is MastraToolInvocationPart => candidate.type === 'tool-invocation',
    );
    expect(part?.toolInvocation).toMatchObject({
      state: 'output-error',
      result: value,
      errorText,
    });

    expect(AIV5Adapter.toUIMessage(message).parts).toContainEqual(
      expect.objectContaining({
        type: 'tool-lookup',
        state: 'output-error',
        errorText,
      }),
    );
  });
});
