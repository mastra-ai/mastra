import { anthropic } from '@ai-sdk/anthropic-v5';
import { createGatewayMock } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { createTool } from '../tools';

// Anthropic only defers provider tool execution non-deterministically, so this
// test must always run against the recorded response.
const mock = createGatewayMock();
beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

/**
 * Assert that no toolCallId appears in more than one message.
 * If a call is split (call in msg A, result in msg B), this will catch it.
 */
function assertNoSplitToolCalls(assistantMessages: any[]) {
  const toolCallIdToMessageId = new Map<string, string>();
  for (const msg of assistantMessages) {
    for (const part of msg.content.parts || []) {
      if (part.type === 'tool-invocation') {
        const tcId = part.toolInvocation.toolCallId;
        const existingMsgId = toolCallIdToMessageId.get(tcId);
        if (existingMsgId && existingMsgId !== msg.id) {
          throw new Error(
            `toolCallId ${tcId} found in multiple messages: ${existingMsgId} and ${msg.id}. ` +
              `This means the tool call and result were split across messages.`,
          );
        }
        toolCallIdToMessageId.set(tcId, msg.id);
      }
    }
  }
}

describe('provider-executed tool message persistence', () => {
  // When Anthropic sees both a server_tool_use (web_search) and a tool_use (client tool)
  // in the same turn, it returns stop_reason:tool_use WITHOUT executing the web search.
  // The web search result arrives in a subsequent API call (deferred execution).
  //
  // This test uses a recorded API response that captures this deferred behavior.
  // On main, the deferred web_search result was persisted as a stub
  // { providerExecuted: true, toolName: 'web_search' } instead of real data.
  it(
    'stream - deferred web_search should persist with real data in correct part order when used alongside a client tool',
    { timeout: 60000 },
    async () => {
      const mockMemory = new MockMemory();
      const webSearch = anthropic.tools.webSearch_20250305({});

      const clientTool = createTool({
        id: 'lookup',
        description: 'Look up detailed information about a topic.',
        inputSchema: z.object({
          topic: z.string().describe('The topic to look up'),
        }),
        outputSchema: z.object({
          details: z.string(),
        }),
        execute: async input => {
          return { details: `Detailed info about ${input.topic}` };
        },
      });

      const agent = new Agent({
        id: 'test-anthropic-deferred-provider-tool-agent',
        name: 'test-anthropic-deferred-provider-tool-agent',
        instructions:
          'You are a research assistant. When asked to research a topic, ALWAYS use BOTH the web search tool AND the lookup tool in parallel. Call both tools at the same time.',
        model: 'anthropic/claude-haiku-4-5-20251001',
        memory: mockMemory,
        tools: { web_search: webSearch, lookup: clientTool },
      });

      const threadId = 'thread-provider-tool-deferred';
      const resourceId = 'resource-provider-tool-deferred';

      const result = await agent.stream(
        'Research the history of TypeScript. Use both web search and the lookup tool.',
        {
          memory: { thread: threadId, resource: resourceId },
        },
      );

      const toolCallChunks: any[] = [];
      const toolResultChunks: any[] = [];
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call') toolCallChunks.push(chunk);
        if (chunk.type === 'tool-result') toolResultChunks.push(chunk);
      }

      await result.consumeStream();

      const text = await result.text;
      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(0);

      // ── Stream chunk assertions ──

      // Should have tool-call chunks for both tools
      expect(toolCallChunks).toHaveLength(2);
      expect(toolCallChunks.map((c: any) => c.payload.toolName).sort()).toEqual(['lookup', 'web_search']);

      // Every tool-result chunk must have a defined result (no empty/deferred stubs)
      for (const chunk of toolResultChunks) {
        expect(chunk.payload.result).toBeDefined();
        expect(chunk.payload.result).not.toBeNull();
      }

      // No duplicate tool-result chunks for the same toolCallId
      const resultCallIds = toolResultChunks.map((c: any) => c.payload.toolCallId);
      expect(resultCallIds.length).toBe(new Set(resultCallIds).size);

      // ── Persistence assertions ──

      // Verify persistence in storage
      const { messages } = await mockMemory.recall({ threadId, resourceId });
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      // All web_search parts must be state:'result' with real data
      const webSearchParts = assistantMessages.flatMap((m: any) =>
        m.content.parts.filter((p: any) => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search'),
      );
      expect(webSearchParts.length).toBeGreaterThan(0);

      for (const part of webSearchParts) {
        expect(part.toolInvocation.state).toBe('result');
        const inv = part.toolInvocation as any;
        expect(inv.result).toBeDefined();
        expect(inv.result).not.toBeNull();
        // Must be real web search data, not a stub
        expect(inv.result).not.toEqual({ providerExecuted: true, toolName: 'web_search' });
      }

      // No orphaned call-only parts
      const orphanedCalls = webSearchParts.filter(
        (p: any) => p.type === 'tool-invocation' && p.toolInvocation.state === 'call',
      );
      expect(orphanedCalls).toHaveLength(0);

      // No tool call should be split across messages
      assertNoSplitToolCalls(assistantMessages);

      // ── Part ordering assertions ──
      // Verify persisted parts match the stream order from the provider.
      // Anthropic sends: text → server_tool_use(web_search) → tool_use(lookup)
      // The persisted message should preserve this order.
      const turn1Message = assistantMessages[0];
      const turn1Parts = turn1Message.content.parts;
      const turn1Types = turn1Parts.map((p: any) => {
        if (p.type === 'tool-invocation') return `tool-invocation(${p.toolInvocation.toolName})`;
        return p.type;
      });

      // text must come before tool invocations
      const textIndex = turn1Types.findIndex((t: string) => t === 'text');
      const webSearchIndex = turn1Types.findIndex((t: string) => t === 'tool-invocation(web_search)');
      const lookupIndex = turn1Types.findIndex((t: string) => t === 'tool-invocation(lookup)');

      expect(textIndex).toBeGreaterThanOrEqual(0);
      expect(webSearchIndex).toBeGreaterThanOrEqual(0);
      expect(lookupIndex).toBeGreaterThanOrEqual(0);

      // Stream order: text < web_search < lookup
      expect(textIndex).toBeLessThan(webSearchIndex);
      expect(webSearchIndex).toBeLessThan(lookupIndex);
    },
  );

  // Single-turn: only web_search, no client tools, so Anthropic executes it immediately
  // (no deferral). Verifies that the tool-call + tool-result flow works for non-deferred
  // provider tool calls.
  it(
    'stream - single-turn web_search (no client tools) should persist with real data in correct part order',
    { timeout: 60000 },
    async () => {
      const mockMemory = new MockMemory();
      const webSearch = anthropic.tools.webSearch_20250305({});

      const agent = new Agent({
        id: 'test-anthropic-single-turn-provider-tool-agent',
        name: 'test-anthropic-single-turn-provider-tool-agent',
        instructions: 'You are a research assistant. When asked about a topic, use web search to find information.',
        model: 'anthropic/claude-haiku-4-5-20251001',
        memory: mockMemory,
        tools: { web_search: webSearch },
      });

      const threadId = 'thread-provider-tool-single-turn';
      const resourceId = 'resource-provider-tool-single-turn';

      const result = await agent.stream('What is the current population of Tokyo?', {
        memory: { thread: threadId, resource: resourceId },
      });

      const toolCallChunks: any[] = [];
      const toolResultChunks: any[] = [];
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call') toolCallChunks.push(chunk);
        if (chunk.type === 'tool-result') toolResultChunks.push(chunk);
      }

      await result.consumeStream();

      const text = await result.text;
      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(0);

      // Should have a tool-call chunk for web_search
      expect(toolCallChunks.length).toBeGreaterThanOrEqual(1);
      expect(toolCallChunks.some((c: any) => c.payload.toolName === 'web_search')).toBe(true);

      // Every tool-result chunk must have a defined result
      for (const chunk of toolResultChunks) {
        expect(chunk.payload.result).toBeDefined();
        expect(chunk.payload.result).not.toBeNull();
      }

      // ── Persistence assertions ──
      const { messages } = await mockMemory.recall({ threadId, resourceId });
      const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      // All web_search parts must be state:'result' with real data
      const webSearchParts = assistantMessages.flatMap((m: any) =>
        m.content.parts.filter((p: any) => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search'),
      );
      expect(webSearchParts.length).toBeGreaterThan(0);

      for (const part of webSearchParts) {
        expect(part.toolInvocation.state).toBe('result');
        expect(part.toolInvocation.result).toBeDefined();
        expect(part.toolInvocation.result).not.toBeNull();
        expect(part.toolInvocation.result).not.toEqual({ providerExecuted: true, toolName: 'web_search' });
      }

      // No orphaned call-only parts
      const orphanedCalls = webSearchParts.filter((p: any) => p.toolInvocation.state === 'call');
      expect(orphanedCalls).toHaveLength(0);

      // No tool call should be split across messages
      assertNoSplitToolCalls(assistantMessages);

      // ── Part ordering assertions ──
      // Single-turn: Anthropic sends web_search (tool call + result) before text.
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      const parts = lastAssistantMessage.content.parts;
      const partTypes = parts.map((p: any) => {
        if (p.type === 'tool-invocation') return `tool-invocation(${p.toolInvocation.toolName})`;
        return p.type;
      });

      const wsIndex = partTypes.findIndex((t: string) => t === 'tool-invocation(web_search)');
      const textIndex = partTypes.findIndex((t: string) => t === 'text');

      expect(wsIndex).toBeGreaterThanOrEqual(0);
      expect(textIndex).toBeGreaterThanOrEqual(0);
      // web_search should come before text in single-turn
      expect(wsIndex).toBeLessThan(textIndex);
    },
  );
});
