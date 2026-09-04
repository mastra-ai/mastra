import { describe, expect, it } from 'vitest';

import { aiV5ModelMessageToV2PromptMessage } from './to-prompt';

// Regression tests for #21138 — DurableAgent inference crashed with
// "Cannot read properties of undefined (reading 'type')" when malformed
// messages (undefined content entries or output-less tool results) reached
// the provider converter.
describe('aiV5ModelMessageToV2PromptMessage malformed message hardening', () => {
  it('skips undefined/null holes in content arrays instead of crashing', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
      role: 'assistant',
      content: [undefined, { type: 'text', text: 'hello' }, null] as any,
    });

    expect(result.role).toBe('assistant');
    expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('treats undefined content as empty instead of crashing', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
      role: 'assistant',
      content: undefined as any,
    });

    expect(result.content).toEqual([]);
  });

  it('backfills a valid output for tool-result parts missing output', () => {
    const result = aiV5ModelMessageToV2PromptMessage({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'myTool',
          output: undefined,
        } as any,
      ],
    });

    expect(result.role).toBe('tool');
    // Providers (e.g. @ai-sdk/openai-compatible) read output.type unguarded.
    expect((result.content[0] as any).output).toEqual({ type: 'json', value: null });
  });

  it('leaves valid tool-result outputs untouched', () => {
    const output = { type: 'json', value: { ok: true } };
    const result = aiV5ModelMessageToV2PromptMessage({
      role: 'tool',
      content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'myTool', output } as any],
    });

    expect((result.content[0] as any).output).toEqual(output);
  });
});
