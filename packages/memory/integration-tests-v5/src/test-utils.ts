import { MessageList } from '@mastra/core/agent';
import type { MastraMessageV2 } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { MastraMessageV1 } from '@mastra/core/memory';

const toolArgs = {
  weather: { location: 'New York' },
  calculator: { expression: '2+2' },
  search: { query: 'latest AI developments' },
};

const toolResults = {
  weather: 'Pretty hot',
  calculator: '4',
  search: 'Anthropic blah blah blah',
};

/**
 * Creates a simulated conversation history with alternating messages and occasional tool calls
 * @param threadId Thread ID for the messages
 * @param messageCount Number of turn pairs (user + assistant) to generate
 * @param toolFrequency How often to include tool calls (e.g., 3 means every 3rd assistant message)
 * @returns Array of messages representing the conversation
 */
export function generateConversationHistory({
  threadId,
  resourceId = 'test-resource',
  messageCount = 5,
  toolFrequency = 3,
  toolNames = ['weather', 'calculator', 'search'],
}: {
  threadId: string;
  resourceId?: string;
  messageCount?: number;
  toolFrequency?: number;
  toolNames?: (keyof typeof toolArgs)[];
}): {
  messages: MastraMessageV1[];
  messagesV2: MastraMessageV2[];
  fakeCore: CoreMessage[];
  counts: { messages: number; toolCalls: number; toolResults: number };
} {
  const counts = { messages: 0, toolCalls: 0, toolResults: 0 };
  // Create some words that will each be about one token
  const words = ['apple', 'banana', 'orange', 'grape'];
  // Arguments for different tools

  const messages: MastraMessageV2[] = [];
  const startTime = Date.now();

  // Generate message pairs (user message followed by assistant response)
  for (let i = 0; i < messageCount; i++) {
    // Create user message content
    const userContent = Array(25).fill(words).flat().join(' '); // ~100 tokens

    // Add user message
    messages.push({
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: userContent }] },
      id: `message-${i * 2}`,
      threadId,
      resourceId,
      createdAt: new Date(startTime + i * 2000), // Each pair 2 seconds apart
    });
    counts.messages++;

    // Determine if this assistant message should include a tool call
    const includeTool = i > 0 && i % toolFrequency === 0;
    const toolIndex = includeTool ? (i / toolFrequency) % toolNames.length : -1;
    const toolName = includeTool ? toolNames[toolIndex] : '';

    // Create assistant message
    if (includeTool) {
      // Assistant message with tool call
      messages.push({
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: `Using ${toolName} tool:` },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: `tool-${i}`,
                toolName,
                args: toolArgs[toolName as keyof typeof toolArgs] || {},
                result: toolResults[toolName as keyof typeof toolResults] || {},
              },
            },
          ],
        },
        id: `tool-call-${i * 2 + 1}`,
        threadId,
        resourceId,
        createdAt: new Date(startTime + i * 2000 + 1000), // 1 second after user message
      });
      counts.messages++;
      counts.toolCalls++;
      counts.toolResults++;
    } else {
      // Regular assistant text message
      messages.push({
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: Array(15).fill(words).flat().join(' ') }] }, // ~60 tokens
        id: `message-${i * 2 + 1}`,
        threadId,
        resourceId,
        createdAt: new Date(startTime + i * 2000 + 1000), // 1 second after user message
      });
      counts.messages++;
    }
  }

  const latestMessage = messages.at(-1)!;
  if (latestMessage.role === `assistant` && latestMessage.content.parts.at(-1)?.type === `tool-invocation`) {
    const userContent = Array(25).fill(words).flat().join(' '); // ~100 tokens
    messages.push({
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: userContent }] },
      id: `message-${messages.length + 1 * 2}`,
      threadId,
      resourceId,
      createdAt: new Date(startTime + messages.length + 1 * 2000), // Each pair 2 seconds apart
    });
    counts.messages++;
  }

  const list = new MessageList().add(messages, 'memory');
  return {
    fakeCore: list.get.all.v1() as CoreMessage[],
    messages: list.get.all.v1(),
    messagesV2: list.get.all.v2(),
    counts,
  };
}

export function filterToolCallsByName(messages: CoreMessage[], name: string) {
  return messages.filter(
    m => Array.isArray(m.content) && m.content.some(part => part.type === 'tool-call' && part.toolName === name),
  );
}
export function filterToolResultsByName(messages: CoreMessage[], name: string) {
  return messages.filter(
    m => Array.isArray(m.content) && m.content.some(part => part.type === 'tool-result' && part.toolName === name),
  );
}
