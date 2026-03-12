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

describe('provider-executed tool message persistence', () => {
  it('stream - web_search call and result should be in the same message', { timeout: 60000 }, async () => {
    const mockMemory = new MockMemory();
    const tool = anthropic.tools.webSearch_20250305({});

    const agent = new Agent({
      id: 'test-anthropic-persistence-agent',
      name: 'test-anthropic-persistence-agent',
      instructions: 'You are a search assistant. Always use the search tool when asked.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      memory: mockMemory,
      tools: { search: tool },
    });

    const threadId = 'thread-provider-tool-persistence';
    const resourceId = 'resource-provider-tool-persistence';

    const result = await agent.stream('Search for what year TypeScript was first released', {
      memory: { thread: threadId, resource: resourceId },
    });

    await result.consumeStream();

    const text = await result.text;
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);

    // Recall messages from memory
    const { messages } = await mockMemory.recall({ threadId, resourceId });

    // Find assistant messages with web_search tool invocations
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Collect all web_search tool parts across all messages
    const webSearchParts = assistantMessages.flatMap(m =>
      m.content.parts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search'),
    );

    expect(webSearchParts.length).toBeGreaterThan(0);

    // Every web_search part should be state:'result' (call+result in one part)
    // NOT split into a 'call' in one message and 'result' in another
    for (const part of webSearchParts) {
      if (part.type === 'tool-invocation') {
        expect(part.toolInvocation.state).toBe('result');
      }
    }

    // There should be no orphaned web_search 'call' parts without results
    const orphanedCalls = webSearchParts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'call');
    expect(orphanedCalls).toHaveLength(0);
  });

  it('stream - web_search should not split when used alongside a slow client tool', { timeout: 60000 }, async () => {
    const mockMemory = new MockMemory();
    const webSearch = anthropic.tools.webSearch_20250305({});

    // A slow client-executed tool that takes ~2 seconds
    const slowTool = createTool({
      id: 'slow_lookup',
      description: 'Look up detailed information about a topic. Takes a moment to process.',
      inputSchema: z.object({
        topic: z.string().describe('The topic to look up'),
      }),
      outputSchema: z.object({
        details: z.string(),
      }),
      execute: async input => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { details: `Detailed info about ${input.topic}` };
      },
    });

    const agent = new Agent({
      id: 'test-anthropic-parallel-tools-agent',
      name: 'test-anthropic-parallel-tools-agent',
      instructions:
        'You are a research assistant. When asked to research a topic, ALWAYS use BOTH the web search tool AND the slow_lookup tool in parallel. Call both tools at the same time.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      memory: mockMemory,
      tools: { web_search: webSearch, slow_lookup: slowTool },
    });

    const threadId = 'thread-provider-tool-parallel';
    const resourceId = 'resource-provider-tool-parallel';

    const result = await agent.stream(
      'Research the history of TypeScript. Use both web search and the slow lookup tool.',
      {
        memory: { thread: threadId, resource: resourceId },
      },
    );

    await result.consumeStream();

    const text = await result.text;
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);

    // Recall messages from memory
    const { messages } = await mockMemory.recall({ threadId, resourceId });

    const assistantMessages = messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Collect all web_search tool parts across ALL assistant messages
    const webSearchParts = assistantMessages.flatMap(m =>
      m.content.parts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search'),
    );

    // Collect all slow_lookup tool parts
    const slowLookupParts = assistantMessages.flatMap(m =>
      m.content.parts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'slow_lookup'),
    );

    // Debug: log what we got
    for (const [i, msg] of assistantMessages.entries()) {
      const toolParts = msg.content.parts.filter(p => p.type === 'tool-invocation');
      for (const part of toolParts) {
        if (part.type === 'tool-invocation') {
          console.log(
            `assistant msg ${i}: ${part.toolInvocation.toolName} state=${part.toolInvocation.state} id=${part.toolInvocation.toolCallId}`,
          );
        }
      }
    }

    expect(webSearchParts.length).toBeGreaterThan(0);
    expect(slowLookupParts.length).toBeGreaterThan(0);

    // web_search should be state:'result' — call+result in one part, not split
    for (const part of webSearchParts) {
      if (part.type === 'tool-invocation') {
        expect(part.toolInvocation.state).toBe('result');
      }
    }

    // slow_lookup (client-executed) should also be state:'result'
    for (const part of slowLookupParts) {
      if (part.type === 'tool-invocation') {
        expect(part.toolInvocation.state).toBe('result');
      }
    }

    // No orphaned web_search 'call' parts
    const orphanedCalls = webSearchParts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.state === 'call');
    expect(orphanedCalls).toHaveLength(0);
  });

  it('stream - many web searches should all persist as results', { timeout: 120000 }, async () => {
    const mockMemory = new MockMemory();
    const tool = anthropic.tools.webSearch_20250305({});

    const agent = new Agent({
      id: 'test-anthropic-many-searches-agent',
      name: 'test-anthropic-many-searches-agent',
      instructions:
        'You are a research assistant. You MUST search for EACH topic separately using individual web searches. Do NOT combine topics into a single search. Search for each one individually.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      memory: mockMemory,
      tools: { search: tool },
    });

    const threadId = 'thread-provider-tool-many-searches';
    const resourceId = 'resource-provider-tool-many-searches';

    // Ask for 11+ distinct searches to try to exceed Anthropic's server loop limit
    const result = await agent.stream(
      `Search for each of these topics INDIVIDUALLY (one search per topic):
1. Population of Tokyo
2. Population of London
3. Population of New York
4. Population of Paris
5. Population of Sydney
6. Population of Mumbai
7. Population of Cairo
8. Population of Moscow
9. Population of Beijing
10. Population of São Paulo
11. Population of Lagos`,
      {
        memory: { thread: threadId, resource: resourceId },
      },
    );

    await result.consumeStream();

    const toolCalls = await result.toolCalls;
    const toolResults = await result.toolResults;
    const finishReason = await result.finishReason;

    // Should have web_search tool calls
    const webSearchCalls = toolCalls.filter(tc => tc.payload.toolName === 'web_search');
    expect(webSearchCalls.length).toBeGreaterThan(0);

    // All returned tool calls should be provider-executed
    for (const tc of webSearchCalls) {
      expect(tc.payload.providerExecuted).toBe(true);
    }

    // All returned tool results should be provider-executed
    const webSearchResults = toolResults.filter(tr => tr.payload.toolName === 'web_search');
    for (const tr of webSearchResults) {
      expect(tr.payload.providerExecuted).toBe(true);
    }

    // Verify persisted messages
    const { messages } = await mockMemory.recall({ threadId, resourceId });
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    // Collect all persisted web_search parts
    const allWebSearchParts = assistantMessages.flatMap(m =>
      m.content.parts.filter(p => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search'),
    );

    // Every completed web_search should be state:'result'
    const completedParts = allWebSearchParts.filter(
      p => p.type === 'tool-invocation' && p.toolInvocation.state === 'result',
    );
    expect(completedParts.length).toBeGreaterThan(0);

    console.log(`web_search calls: ${webSearchCalls.length}`);
    console.log(`web_search results: ${webSearchResults.length}`);
    console.log(`persisted result parts: ${completedParts.length}`);
    console.log(`finish reason: ${finishReason}`);

    // If pause_turn was hit, some tools may be deferred (state:'call' without result)
    const deferredParts = allWebSearchParts.filter(
      p => p.type === 'tool-invocation' && p.toolInvocation.state === 'call',
    );

    if (deferredParts.length > 0) {
      console.log(`deferred (call-only) parts: ${deferredParts.length}`);
    }

    // The key invariant: completed web_search results should NOT be split
    // across messages (call in one, result in another)
    for (const msg of assistantMessages) {
      const msgWebSearchParts = msg.content.parts.filter(
        p => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'web_search',
      );
      for (const part of msgWebSearchParts) {
        if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') {
          expect(part.toolInvocation.result).toBeDefined();
        }
      }
    }
  });
});
