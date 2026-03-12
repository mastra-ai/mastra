import { anthropic } from '@ai-sdk/anthropic-v5';
import { createGatewayMock } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { createTool } from '../tools';

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
    'stream - deferred web_search result should persist with real data when used alongside a client tool',
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

      await result.consumeStream();

      const text = await result.text;
      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(0);

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
        if (part.type === 'tool-invocation') {
          expect(part.toolInvocation.state).toBe('result');
          const inv = part.toolInvocation as any;
          expect(inv.result).toBeDefined();
          expect(inv.result).not.toBeNull();
          // Must be real web search data, not a stub
          expect(inv.result).not.toEqual({ providerExecuted: true, toolName: 'web_search' });
        }
      }

      // No orphaned call-only parts
      const orphanedCalls = webSearchParts.filter(
        (p: any) => p.type === 'tool-invocation' && p.toolInvocation.state === 'call',
      );
      expect(orphanedCalls).toHaveLength(0);

      // No tool call should be split across messages
      assertNoSplitToolCalls(assistantMessages);
    },
  );
});
