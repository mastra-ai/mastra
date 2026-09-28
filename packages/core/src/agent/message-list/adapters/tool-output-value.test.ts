import { describe, expect, it } from 'vitest';

import type { MastraDBMessage, MastraToolInvocationPart } from '../state/types';
import type { AIV5Type, AIV6Type } from '../types';
import { AIV5Adapter } from './AIV5Adapter';
import { AIV6Adapter } from './AIV6Adapter';

const output = { value: 42, receipt: 'r-1' };

function expectStoredOutput(message: MastraDBMessage) {
  expect(message.content.toolInvocations?.[0]?.result).toEqual(output);

  const part = message.content.parts.find(
    (candidate): candidate is MastraToolInvocationPart => candidate.type === 'tool-invocation',
  );
  expect(part?.toolInvocation).toMatchObject({ state: 'result', result: output });
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
