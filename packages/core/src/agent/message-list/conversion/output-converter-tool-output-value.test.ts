import { describe, expect, it } from 'vitest';

import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages, sanitizeV5UIMessages } from './output-converter';

const output = { value: 42, receipt: 'r-1' };

function makeMessage(toolOutput: unknown): AIV5Type.UIMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-lookup',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: toolOutput,
      },
    ],
  };
}

describe('v5 tool output containing a value key', () => {
  it.each(['response', 'prompt', 'prompt-with-suspended'] as const)(
    'preserves sibling fields while sanitizing in %s mode',
    mode => {
      const result = sanitizeV5UIMessages([makeMessage(output)], mode);
      const toolPart = result[0]?.parts[0];

      expect(toolPart).toMatchObject({ state: 'output-available', output });
    },
  );

  it('preserves sibling fields in converted model messages', () => {
    const result = aiV5UIMessagesToAIV5ModelMessages([makeMessage(output)], [], 'prompt');

    expect(JSON.stringify(result)).toContain('"receipt":"r-1"');
  });

  it('keeps unwrapping the legacy sole-key wrapper', () => {
    const result = sanitizeV5UIMessages([makeMessage({ value: 42 })], 'prompt');

    expect(result[0]?.parts[0]).toMatchObject({ state: 'output-available', output: 42 });
  });

  it('unwraps an AI SDK JSON output wrapper before model conversion', () => {
    const result = sanitizeV5UIMessages([makeMessage({ type: 'json', value: { ok: true } })], 'prompt');

    expect(result[0]?.parts[0]).toMatchObject({ state: 'output-available', output: { ok: true } });
  });

  it('preserves a raw tool result with a custom type', () => {
    const toolOutput = { type: 'celsius', value: 20 };
    const result = sanitizeV5UIMessages([makeMessage(toolOutput)], 'prompt');

    expect(result[0]?.parts[0]).toMatchObject({ state: 'output-available', output: toolOutput });
  });

  it('preserves the native multimodal content wrapper', () => {
    const toolOutput = { type: 'content', value: [{ type: 'text', text: 'ok' }] };
    const result = sanitizeV5UIMessages([makeMessage(toolOutput)], 'prompt');

    expect(result[0]?.parts[0]).toMatchObject({ state: 'output-available', output: toolOutput });
  });
});
