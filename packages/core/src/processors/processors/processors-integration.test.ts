import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, it, expect } from 'vitest';

import type { MastraDBMessage } from '../../agent/message-list';
import { MessageList } from '../../agent/message-list';
import { ProcessorRunner } from '../runner';

import { TokenLimiterProcessor } from './token-limiter';
import { ToolCallFilter } from './tool-call-filter';

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trackException: () => {},
} as any;

/**
 * ToolCallFilter rewrites the model prompt only, so these helpers build the real prompt
 * from a MessageList and run the filter over it.
 */
async function filterPrompt(filter: ToolCallFilter, messageList: MessageList): Promise<LanguageModelV2Prompt> {
  const prompt = await messageList.get.all.aiV5.llmPrompt();
  const result = await filter.processLLMRequest?.({
    prompt,
    model: 'test-model' as any,
    stepNumber: 0,
    steps: [],
    state: {},
    abort: ((reason?: string) => {
      throw new Error(reason || 'Aborted');
    }) as (reason?: string) => never,
  } as any);

  return result?.prompt ?? prompt;
}

function toolPartsIn(prompt: LanguageModelV2Prompt, toolName?: string) {
  return prompt.flatMap(message =>
    typeof message.content === 'string'
      ? []
      : (message.content as any[]).filter(
          part =>
            (part.type === 'tool-call' || part.type === 'tool-result') &&
            (toolName === undefined || part.toolName === toolName),
        ),
  );
}

function textsIn(prompt: LanguageModelV2Prompt): string[] {
  return prompt.flatMap(message =>
    typeof message.content === 'string'
      ? [message.content]
      : (message.content as any[]).flatMap(part => (part.type === 'text' ? [part.text] : [])),
  );
}

describe('Processors Integration Tests', () => {
  const mockAbort = ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;

  /**
   * Test processor chaining with ToolCallFilter + TokenLimiter
   *
   * Origin: Migrated from packages/memory/integration-tests/src/processors.test.ts
   * Test name: "should apply multiple processors in order"
   *
   * Purpose: Verify that multiple processors can be chained together in a specific order
   * and that each processor operates on the output of the previous processor.
   */
  it('should chain multiple processors in order (ToolCallFilter + TokenLimiter)', async () => {
    // Create messages with tool calls and text content
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather in NYC?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The weather in NYC is sunny and 72°F. It is a beautiful day outside with clear skies.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-1',
                toolName: 'weather',
                args: { location: 'NYC' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-1',
                toolName: 'weather',
                args: {},
                result: 'Sunny, 72°F',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-5',
        role: 'user',
        content: {
          format: 2,
          content: 'What about San Francisco?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content: {
          format: 2,
          content: 'San Francisco is foggy with a temperature of 58°F.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-2',
                toolName: 'time',
                args: { location: 'SF' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-2',
                toolName: 'time',
                args: {},
                result: '3:45 PM',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
    ];

    // Step 1: Apply ToolCallFilter to exclude weather tool calls
    const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });

    // Create MessageList and add messages
    const messageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    for (const msg of messages) {
      messageList.add(msg, 'input');
    }

    const filteredPrompt = await filterPrompt(toolCallFilter, messageList);

    // Verify ToolCallFilter removed weather tool parts from the prompt only
    expect(toolPartsIn(filteredPrompt, 'weather')).toHaveLength(0);
    expect(toolPartsIn(filteredPrompt, 'time').length).toBeGreaterThan(0); // Time tool call preserved
    // The stored messages are untouched
    expect(messageList.get.all.db()).toHaveLength(4);

    // Step 2: Apply TokenLimiter to limit message count
    // TokenLimiter with a low limit should further reduce messages
    const tokenLimiter = new TokenLimiterProcessor({ limit: 50 });

    // Create a new MessageList with the filtered messages for the token limiter
    const limiterMessageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    for (const msg of messageList.get.all.db()) {
      limiterMessageList.add(msg, 'input');
    }

    await tokenLimiter.processInputStep({
      messageList: limiterMessageList,
      messages: limiterMessageList.get.all.db(),
      abort: mockAbort,
      stepNumber: 0,
      steps: [],
      state: {},
      systemMessages: [],
      model: { modelId: 'test-model' } as any,
      retryCount: 0,
    });

    const limitedMessages = limiterMessageList.get.all.db();

    // Verify TokenLimiter further reduced messages
    expect(limitedMessages.length).toBeLessThanOrEqual(messageList.get.all.db().length);
    expect(limitedMessages.length).toBeGreaterThan(0); // Should have at least some messages

    // Verify no message duplication
    const messageIds = limitedMessages.map(m => m.id);
    const uniqueIds = new Set(messageIds);
    expect(messageIds.length).toBe(uniqueIds.size);

    // Verify final messages are a subset of the original messages
    limitedMessages.forEach(msg => {
      expect(messageList.get.all.db().some(m => m.id === msg.id)).toBe(true);
    });
  });

  it('should apply multiple processors without duplicating messages', async () => {
    // Create test messages
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'Hello',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Weather is sunny',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'tc-1',
                toolName: 'weather',
                args: { location: 'NYC' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'tc-1',
                toolName: 'weather',
                args: {},
                result: 'Sunny',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-3',
        role: 'user',
        content: {
          format: 2,
          content: 'What time is it?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: {
          format: 2,
          content: 'It is 3:45 PM',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'tc-2',
                toolName: 'time',
                args: {},
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'tc-2',
                toolName: 'time',
                args: {},
                result: '3:45 PM',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-5',
        role: 'user',
        content: {
          format: 2,
          content: 'Thanks',
          parts: [],
        },
        createdAt: new Date(),
      },
    ];

    // Create MessageList and add messages
    const messageList = new MessageList({
      threadId: 'test-thread',
      resourceId: 'test-resource',
    });

    for (const msg of messages) {
      messageList.add(msg, 'input');
    }

    // Apply ToolCallFilter (exclude 'weather') — prompt-only
    const toolCallFilter = new ToolCallFilter({ exclude: ['weather'] });
    const filteredPrompt = await filterPrompt(toolCallFilter, messageList);
    expect(toolPartsIn(filteredPrompt, 'weather')).toHaveLength(0);

    // Apply TokenLimiter
    const tokenLimiter = new TokenLimiterProcessor({ limit: 100 });
    const limiterMessageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    for (const msg of messageList.get.all.db()) {
      limiterMessageList.add(msg, 'input');
    }

    await tokenLimiter.processInputStep({
      messageList: limiterMessageList,
      messages: limiterMessageList.get.all.db(),
      abort: mockAbort,
      stepNumber: 0,
      steps: [],
      state: {},
      systemMessages: [],
      model: { modelId: 'test-model' } as any,
      retryCount: 0,
    });

    const limitedMessages = limiterMessageList.get.all.db();

    // Verify no duplicates by checking unique IDs
    const messageIds = limitedMessages.map(m => m.id);
    const uniqueIds = new Set(messageIds);

    expect(uniqueIds.size).toBe(messageIds.length);

    // Verify all messages are unique by content
    const messageContents = limitedMessages.map(m => JSON.stringify(m));
    const uniqueContents = new Set(messageContents);

    expect(uniqueContents.size).toBe(messageContents.length);

    // Verify final messages are subset of the original messages
    const filteredIds = new Set(messageList.get.all.db().map(m => m.id));
    for (const msg of limitedMessages) {
      expect(filteredIds.has(msg.id)).toBe(true);
    }
  });

  /**
   * Test processors with a real Mastra agent integration
   *
   * Origin: Migrated from packages/memory/integration-tests/src/processors.test.ts
   * Test name: "should apply processors with a real Mastra agent"
   *
   * Purpose: Verify that processors work correctly when used directly with ProcessorRunner,
   * simulating how they're used in the agent's memory system.
   *
   * Note: This is a unit test that verifies processor behavior without requiring
   * a full agent setup or LLM calls. Integration tests with real agents are in
   * packages/memory/integration-tests/
   */
  it('should integrate processors with ProcessorRunner', async () => {
    // Create messages simulating a conversation with tool calls
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: {
          format: 2,
          content: 'What is the weather in Seattle?',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The weather in Seattle is sunny and 70 degrees.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-weather-1',
                toolName: 'get_weather',
                args: { location: 'Seattle' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-weather-1',
                toolName: 'get_weather',
                args: {},
                result: 'Sunny, 70°F',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-3',
        role: 'user',
        content: {
          format: 2,
          content: 'Calculate 123 * 456',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: {
          format: 2,
          content: 'The result of 123 * 456 is 56088.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-calc-1',
                toolName: 'calculator',
                args: { expression: '123 * 456' },
              },
            },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-calc-1',
                toolName: 'calculator',
                args: {},
                result: '56088',
              },
            },
          ],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-5',
        role: 'user',
        content: {
          format: 2,
          content: 'Tell me something interesting about space',
          parts: [],
        },
        createdAt: new Date(),
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Space is vast and contains billions of galaxies.',
          parts: [],
        },
        createdAt: new Date(),
      },
    ];

    // Create MessageList
    const messageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    for (const msg of messages) {
      messageList.add(msg, 'input');
    }

    // Test 1: Filter weather tool calls
    const weatherFilter = new ToolCallFilter({ exclude: ['get_weather'] });
    const weatherFilteredPrompt = await filterPrompt(weatherFilter, messageList);

    // Should remove weather tool parts from the prompt while keeping the calculator
    expect(toolPartsIn(weatherFilteredPrompt, 'get_weather')).toHaveLength(0);
    expect(toolPartsIn(weatherFilteredPrompt, 'calculator').length).toBeGreaterThan(0);
    // Stored messages are untouched
    expect(messageList.get.all.db().length).toBe(6);

    // Test 2: Apply token limiting with a low limit to force truncation
    // The limiter uses ~24 tokens for conversation overhead + ~3.8 per message
    const tokenLimiter = new TokenLimiterProcessor({ limit: 50 });
    const prompt = await messageList.get.all.aiV5.llmPrompt();

    const limited = await tokenLimiter.processLLMRequest({
      prompt,
      model: { modelId: 'test-model' } as any,
      stepNumber: 0,
      steps: [],
      state: {},
    });

    const tokenLimitedPrompt = limited?.prompt ?? prompt;

    // Should have fewer messages due to token limit (prioritizes recent messages)
    expect(tokenLimitedPrompt.length).toBeLessThan(prompt.length);
    expect(tokenLimitedPrompt.length).toBeGreaterThan(0);

    // Limiting is transient: storage keeps every message
    expect(messageList.get.all.db().length).toBe(6);

    // Test 3: Combine both processors — filter the prompt first, then limit it
    const combinedFilter = new ToolCallFilter({ exclude: ['get_weather', 'calculator'] });
    const combinedFilteredPrompt = await filterPrompt(combinedFilter, messageList);

    const limitedCombined = await tokenLimiter.processLLMRequest({
      prompt: combinedFilteredPrompt,
      model: { modelId: 'test-model' } as any,
      stepNumber: 0,
      steps: [],
      state: {},
    });
    const finalPrompt = limitedCombined?.prompt ?? combinedFilteredPrompt;

    // The prompt should have no tool parts at all, while keeping the conversation text
    expect(toolPartsIn(combinedFilteredPrompt)).toHaveLength(0);
    expect(textsIn(combinedFilteredPrompt)).toContain('Space is vast and contains billions of galaxies.');

    // Storage keeps every original message, including the tool invocations
    expect(messageList.get.all.db().length).toBe(6);
    expect(messageList.get.all.db().some(m => m.id === 'msg-2')).toBe(true);
    expect(messageList.get.all.db().some(m => m.id === 'msg-4')).toBe(true);

    // Final result should be further limited by tokens
    expect(finalPrompt.length).toBeGreaterThan(0);
    expect(finalPrompt.length).toBeLessThanOrEqual(combinedFilteredPrompt.length);
  });

  /**
   * Regression for #24111.
   *
   * `TokenLimiterProcessor` budgets the prompt the model actually receives, so a
   * tool result that `ToolCallFilter` strips no longer counts against the limit.
   * Before this, the limiter counted stored messages during the input stage and
   * dropped the whole message — answer text included.
   */
  it('budgets the prompt after earlier prompt filters have run', async () => {
    const listRulesResult = `House rule: stay off the grass. ${'Registered guests only. '.repeat(2500)}`;

    const messageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    messageList.add(
      {
        id: 'history-user',
        role: 'user',
        content: { format: 2, content: 'What are the house rules?', parts: [] },
        createdAt: new Date('2024-01-01T00:00:00Z'),
      },
      'input',
    );
    messageList.add(
      {
        id: 'history-assistant',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Pets are allowed on weekdays.',
          parts: [
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'call' as const,
                toolCallId: 'call-rules',
                toolName: 'listRules',
                args: {},
              },
            },
            { type: 'text' as const, text: 'Pets are allowed on weekdays.' },
            {
              type: 'tool-invocation' as const,
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call-rules',
                toolName: 'listRules',
                args: {},
                result: listRulesResult,
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:01:00Z'),
      },
      'response',
    );
    messageList.add(
      {
        id: 'current-user',
        role: 'user',
        content: { format: 2, content: 'Can I bring my dog?', parts: [] },
        createdAt: new Date('2024-01-01T00:02:00Z'),
      },
      'input',
    );

    const prompt = await messageList.get.all.aiV5.llmPrompt();

    const run = async (processors: any[]) =>
      new ProcessorRunner({
        inputProcessors: processors,
        logger: mockLogger,
        agentName: 'test-agent',
      }).runProcessLLMRequest({
        prompt,
        model: { modelId: 'test-model' } as any,
        stepNumber: 0,
        steps: [],
      });

    // Filter first: the excluded rule payload is gone before the budget is applied,
    // so the assistant answer fits and survives.
    const filtered = await run([
      new ToolCallFilter({ exclude: ['listRules'] }),
      new TokenLimiterProcessor({ limit: 8000 }),
    ]);

    expect(filtered.prompt.length).toBeLessThan(prompt.length);
    expect(toolPartsIn(filtered.prompt, 'listRules')).toHaveLength(0);
    expect(filtered.prompt.map(m => m.role)).toContain('assistant');
    expect(textsIn(filtered.prompt)).toContain('Pets are allowed on weekdays.');

    // Reversed order: the limiter measures the unfiltered prompt, the whole message
    // is over budget, and the answer is dropped along with the tool payload.
    const reversed = await run([
      new TokenLimiterProcessor({ limit: 8000 }),
      new ToolCallFilter({ exclude: ['listRules'] }),
    ]);

    expect(textsIn(reversed.prompt)).not.toContain('Pets are allowed on weekdays.');
    // The whole assistant message went over budget, so the limiter evicted it
    expect(reversed.prompt.map(m => m.role)).not.toContain('assistant');

    // Neither composition touches stored messages
    expect(messageList.get.all.db().map(m => m.id)).toEqual(['history-user', 'history-assistant', 'current-user']);
  });
});
