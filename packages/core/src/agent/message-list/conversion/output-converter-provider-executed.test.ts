import { describe, expect, it } from 'vitest';
import type { AIV5Type } from '../types';
import { sanitizeV5UIMessages } from './output-converter';

/**
 * Tests for provider-executed tool handling in sanitizeV5UIMessages.
 *
 * Provider-executed tools (e.g. Anthropic web_search_20250305) are executed
 * server-side by the provider API. Both completed (output-available) and
 * pending (input-available) provider-executed tools are kept in the output:
 *
 * - output-available: convertToModelMessages emits both server_tool_use and
 *   the tool result (e.g. web_search_tool_result) in the same assistant
 *   message, which the provider API expects for conversation history.
 *
 * - input-available: kept so the provider API sees the server_tool_use block
 *   and can execute the deferred tool on the next request.
 */
describe('sanitizeV5UIMessages — provider-executed tool handling', () => {
  const makeToolPart = (
    overrides: Partial<AIV5Type.ToolUIPart> & { type: string; toolCallId: string },
  ): AIV5Type.ToolUIPart =>
    ({
      state: 'input-available' as const,
      input: {},
      ...overrides,
    }) as AIV5Type.ToolUIPart;

  const makeMessage = (parts: AIV5Type.UIMessage['parts']): AIV5Type.UIMessage => ({
    id: 'msg-1',
    role: 'assistant',
    parts,
  });

  it('should filter out regular input-available tool parts when filterIncompleteToolCalls is true', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-get_info',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { name: 'test' },
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    // Message should be dropped entirely — its only part was filtered out
    expect(result).toHaveLength(0);
  });

  it('should keep provider-executed input-available tool parts when filterIncompleteToolCalls is true', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as any).toolCallId).toBe('call-1');
    expect((result[0]!.parts[0] as any).providerExecuted).toBe(true);
  });

  it('should keep output-available parts for client-executed tools', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-get_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
  });

  it('should handle mid-loop parallel calls: keep client output-available + provider input-available, drop regular input-available', () => {
    const msg = makeMessage([
      // Regular tool with result — keep
      makeToolPart({
        type: 'tool-get_company_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
      // Provider-executed tool with no client result — keep
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-2',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
      // Regular tool still pending — drop
      makeToolPart({
        type: 'tool-update_record',
        toolCallId: 'call-3',
        state: 'input-available',
        input: { id: '123' },
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);

    const toolCallIds = result[0]!.parts.map((p: any) => p.toolCallId);
    expect(toolCallIds).toContain('call-1');
    expect(toolCallIds).toContain('call-2');
    expect(toolCallIds).not.toContain('call-3');
  });

  it('should keep output-available provider-executed tool parts — convertToModelMessages emits both server_tool_use and result in the same assistant message', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { query: 'anthropic' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as any).toolCallId).toBe('call-1');
    expect((result[0]!.parts[0] as any).providerExecuted).toBe(true);
  });

  it('should keep output-error provider-executed tool parts', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'output-error',
        input: { query: 'test' },
        providerExecuted: true,
      } as any),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
  });

  it('should keep both client and provider output-available tool parts on resume', () => {
    const msg = makeMessage([
      // Client-executed tool with result — keep
      makeToolPart({
        type: 'tool-get_company_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
      // Provider-executed tool already completed — keep (convertToModelMessages handles it)
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-2',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);

    const toolCallIds = result[0]!.parts.map((p: any) => p.toolCallId);
    expect(toolCallIds).toContain('call-1');
    expect(toolCallIds).toContain('call-2');
  });

  it('should not filter provider-executed tools when filterIncompleteToolCalls is false', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
      makeToolPart({
        type: 'tool-get_info',
        toolCallId: 'call-2',
        state: 'input-available',
        input: { name: 'test' },
      }),
    ]);

    // Without filterIncompleteToolCalls, both should be kept (only input-streaming is filtered)
    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);
  });
});
