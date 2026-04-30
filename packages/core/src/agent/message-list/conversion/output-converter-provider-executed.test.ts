import { describe, expect, it } from 'vitest';
import type { AIV5Type } from '../types';
import { addStartStepPartsForAIV5, sanitizeV5UIMessages } from './output-converter';

/**
 * Tests for provider-executed tool handling in sanitizeV5UIMessages.
 *
 * Provider-executed tools (e.g. Anthropic web_search_20250305) are executed
 * server-side by the provider API. When deferred (not yet executed), they
 * remain in 'input-available' state and should be kept — the provider API
 * needs to see the server_tool_use block to execute the tool on the next request.
 * When completed (output-available), they should also be kept so the provider
 * API sees the encryptedContent for citation context.
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

  it('should keep deferred provider-executed input-available tool parts (provider needs server_tool_use in history)', () => {
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

    // Deferred provider tool should be kept — the provider API needs to see
    // the server_tool_use block in the conversation history
    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
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

  it('should keep output-available provider-executed tool parts (provider needs encryptedContent for citations)', () => {
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
  });

  it('should handle mid-loop parallel calls: keep client output-available and deferred provider, drop client input-available', () => {
    const msg = makeMessage([
      // Regular tool with result — keep
      makeToolPart({
        type: 'tool-get_company_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
      // Provider-executed tool deferred (no result yet) — keep for provider history
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

  it('should keep both client and provider output-available in resume scenario', () => {
    const msg = makeMessage([
      // Client-executed tool with result — keep
      makeToolPart({
        type: 'tool-get_company_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
      // Provider-executed tool completed — keep (provider needs encryptedContent)
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

describe('addStartStepPartsForAIV5 — client/provider tool splitting', () => {
  const makeToolPart = (
    overrides: Partial<AIV5Type.ToolUIPart> & { type: string; toolCallId: string },
  ): AIV5Type.ToolUIPart =>
    ({
      state: 'output-available' as const,
      input: {},
      output: {},
      ...overrides,
    }) as AIV5Type.ToolUIPart;

  const makeMessage = (parts: AIV5Type.UIMessage['parts']): AIV5Type.UIMessage => ({
    id: 'msg-1',
    role: 'assistant',
    parts,
  });

  it('should split client tool from completed provider tool (Anthropic ordering fix)', () => {
    // This is the exact scenario that causes the Anthropic error:
    // "tool_use ids were found without tool_result blocks immediately after"
    // When tool_use(client) and server_tool_use(provider) are in the same block,
    // the provider inlines the server result BEFORE the client result.
    const msg = makeMessage([
      { type: 'text', text: 'Let me search and look that up' },
      makeToolPart({
        type: 'tool-execute_command',
        toolCallId: 'toolu_client1',
        state: 'output-available',
        input: { command: 'ls' },
        output: 'file1.ts',
      }),
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_provider1',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
    ]);

    const result = addStartStepPartsForAIV5([msg]);

    // Should insert step-start between client tool and provider tool
    const partTypes = result[0]!.parts.map(p => p.type);
    expect(partTypes).toEqual([
      'text',
      'tool-execute_command',
      'step-start', // split between client and provider
      'tool-web_search_20250305',
    ]);
  });

  it('should NOT split provider tool followed by client tool (safe order)', () => {
    // server_tool_use BEFORE tool_use is fine — the client result comes after
    const msg = makeMessage([
      { type: 'text', text: 'Let me search and look that up' },
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_provider1',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
      makeToolPart({
        type: 'tool-execute_command',
        toolCallId: 'toolu_client1',
        state: 'output-available',
        input: { command: 'ls' },
        output: 'file1.ts',
      }),
    ]);

    const result = addStartStepPartsForAIV5([msg]);

    // No step-start between consecutive tool parts
    const partTypes = result[0]!.parts.map(p => p.type);
    expect(partTypes).toEqual(['text', 'tool-web_search_20250305', 'tool-execute_command']);
  });

  it('should split multiple client tools from provider tool', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-find_files',
        toolCallId: 'toolu_client1',
        state: 'output-available',
        input: { path: '.' },
        output: 'file1.ts',
      }),
      makeToolPart({
        type: 'tool-execute_command',
        toolCallId: 'toolu_client2',
        state: 'output-available',
        input: { command: 'ls' },
        output: 'dir/',
      }),
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_provider1',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
    ]);

    const result = addStartStepPartsForAIV5([msg]);

    const partTypes = result[0]!.parts.map(p => p.type);
    expect(partTypes).toEqual([
      'tool-find_files',
      'tool-execute_command',
      'step-start', // split before provider tool
      'tool-web_search_20250305',
    ]);
  });

  it('should handle client tool, provider tool, then more text', () => {
    const msg = makeMessage([
      { type: 'text', text: 'Searching...' },
      makeToolPart({
        type: 'tool-execute_command',
        toolCallId: 'toolu_client1',
        state: 'output-available',
        input: { command: 'ls' },
        output: 'file1.ts',
      }),
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_provider1',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
      { type: 'text', text: 'Here are the results...' },
    ]);

    const result = addStartStepPartsForAIV5([msg]);

    const partTypes = result[0]!.parts.map(p => p.type);
    expect(partTypes).toEqual([
      'text',
      'tool-execute_command',
      'step-start', // split between client and provider
      'tool-web_search_20250305',
      'step-start', // existing split between tool and text
      'text',
    ]);
  });

  it('should NOT split when provider tool is deferred (input-available)', () => {
    // A deferred provider tool with no result doesn't need splitting —
    // there's no inline result to interfere with ordering
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-execute_command',
        toolCallId: 'toolu_client1',
        state: 'output-available',
        input: { command: 'ls' },
        output: 'file1.ts',
      }),
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_provider1',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
    ]);

    const result = addStartStepPartsForAIV5([msg]);

    // No split — deferred provider tool has no inline result
    const partTypes = result[0]!.parts.map(p => p.type);
    expect(partTypes).toEqual(['tool-execute_command', 'tool-web_search_20250305']);
  });

  it('should NOT split between two client tools', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-find_files',
        toolCallId: 'toolu_client1',
        state: 'output-available',
        input: { path: '.' },
        output: 'file1.ts',
      }),
      makeToolPart({
        type: 'tool-execute_command',
        toolCallId: 'toolu_client2',
        state: 'output-available',
        input: { command: 'ls' },
        output: 'dir/',
      }),
    ]);

    const result = addStartStepPartsForAIV5([msg]);

    const partTypes = result[0]!.parts.map(p => p.type);
    expect(partTypes).toEqual(['tool-find_files', 'tool-execute_command']);
  });
});

/**
 * Tests for empty text part filtering in sanitizeV5UIMessages.
 *
 * Empty text parts can appear in stored messages due to various edge cases.
 * When sent to LLM providers like Anthropic, these cause API errors:
 * "Invalid request: messages: text content blocks must be non-empty"
 */
describe('sanitizeV5UIMessages — empty text part filtering', () => {
  it('should filter out user messages that contain only empty text parts', () => {
    const userMsgWithEmptyText: AIV5Type.UIMessage = {
      id: 'msg-empty-user',
      role: 'user',
      parts: [{ type: 'text', text: '' }],
    };

    const result = sanitizeV5UIMessages([userMsgWithEmptyText], true);

    // User message with only empty text should be removed entirely
    expect(result).toHaveLength(0);
  });

  it('should filter out empty text parts from user messages with other content', () => {
    const userMsgWithMixedParts: AIV5Type.UIMessage = {
      id: 'msg-mixed-user',
      role: 'user',
      parts: [
        { type: 'text', text: '' },
        { type: 'text', text: 'Hello' },
      ],
    };

    const result = sanitizeV5UIMessages([userMsgWithMixedParts], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect(result[0]!.parts[0]).toEqual({ type: 'text', text: 'Hello' });
  });

  it('should filter out user messages with whitespace-only text parts', () => {
    const userMsgWithWhitespace: AIV5Type.UIMessage = {
      id: 'msg-whitespace-user',
      role: 'user',
      parts: [{ type: 'text', text: '   ' }],
    };

    const result = sanitizeV5UIMessages([userMsgWithWhitespace], true);

    // User message with only whitespace text should be removed
    expect(result).toHaveLength(0);
  });

  it('should preserve assistant messages with only empty text parts (placeholder messages)', () => {
    const assistantMsgWithEmptyText: AIV5Type.UIMessage = {
      id: 'msg-empty-assistant',
      role: 'assistant',
      parts: [{ type: 'text', text: '' }],
    };

    const result = sanitizeV5UIMessages([assistantMsgWithEmptyText], true);

    // Assistant message with only empty text should be preserved as placeholder
    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
  });
});

describe('sanitizeV5UIMessages — duplicate OpenAI itemId merging', () => {
  const makeTextPart = (text: string, itemId?: string): AIV5Type.TextUIPart => ({
    type: 'text',
    text,
    ...(itemId && {
      providerMetadata: {
        openai: { itemId },
      },
    }),
  });

  const makeMessage = (parts: AIV5Type.UIMessage['parts']): AIV5Type.UIMessage => ({
    id: 'msg-1',
    role: 'assistant',
    parts,
  });

  it('should merge text parts with the same OpenAI itemId', () => {
    const msg = makeMessage([makeTextPart('Hello ', 'msg_abc123'), makeTextPart('world!', 'msg_abc123')]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as AIV5Type.TextUIPart).text).toBe('Hello world!');
    expect((result[0]!.parts[0] as any).providerMetadata?.openai?.itemId).toBe('msg_abc123');
  });

  it('should merge multiple text parts with the same itemId into one', () => {
    const msg = makeMessage([
      makeTextPart('Part 1. ', 'msg_abc123'),
      makeTextPart('Part 2. ', 'msg_abc123'),
      makeTextPart('Part 3.', 'msg_abc123'),
    ]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as AIV5Type.TextUIPart).text).toBe('Part 1. Part 2. Part 3.');
  });

  it('should keep text parts with different itemIds separate', () => {
    const msg = makeMessage([
      makeTextPart('First response. ', 'msg_abc123'),
      makeTextPart('Second response.', 'msg_def456'),
    ]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);
    expect((result[0]!.parts[0] as AIV5Type.TextUIPart).text).toBe('First response. ');
    expect((result[0]!.parts[1] as AIV5Type.TextUIPart).text).toBe('Second response.');
  });

  it('should not merge text parts without itemIds', () => {
    const msg = makeMessage([makeTextPart('No metadata 1. '), makeTextPart('No metadata 2.')]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);
  });

  it('should handle mixed parts: text with itemId, text without, and tool parts', () => {
    const msg = makeMessage([
      makeTextPart('With itemId part 1. ', 'msg_abc123'),
      { type: 'tool-web_search', toolCallId: 'call-1', state: 'output-available', input: {}, output: {} } as any,
      makeTextPart('With itemId part 2.', 'msg_abc123'),
      makeTextPart('Without itemId.'),
    ]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    // Should have: merged text (itemId), tool, text (no itemId)
    expect(result[0]!.parts).toHaveLength(3);
    expect((result[0]!.parts[0] as AIV5Type.TextUIPart).text).toBe('With itemId part 1. With itemId part 2.');
    expect(result[0]!.parts[1]!.type).toBe('tool-web_search');
    expect((result[0]!.parts[2] as AIV5Type.TextUIPart).text).toBe('Without itemId.');
  });

  it('should handle web search scenario: multiple flushes from source chunks', () => {
    // Simulates OpenAI web search streaming where source chunks trigger text flushes
    const msg = makeMessage([
      makeTextPart('According to recent sources, ', 'msg_websearch_001'),
      makeTextPart('the answer is 42. ', 'msg_websearch_001'),
      makeTextPart('This was confirmed by multiple studies.', 'msg_websearch_001'),
    ]);

    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as AIV5Type.TextUIPart).text).toBe(
      'According to recent sources, the answer is 42. This was confirmed by multiple studies.',
    );
  });
});
