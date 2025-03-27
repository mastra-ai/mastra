import type { MessageType, CoreMessage } from '@mastra/core';

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
  messageCount = 5,
  toolFrequency = 3,
  toolNames = ['weather', 'calculator', 'search'],
}: {
  threadId: string;
  messageCount?: number;
  toolFrequency?: number;
  toolNames?: (keyof typeof toolArgs)[];
}): MessageType[] {
  // Create some words that will each be about one token
  const words = ['apple', 'banana', 'orange', 'grape'];
  // Arguments for different tools

  const messages: MessageType[] = [];
  const startTime = Date.now();

  // Generate message pairs (user message followed by assistant response)
  for (let i = 0; i < messageCount; i++) {
    // Create user message content
    const userContent = Array(25).fill(words).flat().join(' '); // ~100 tokens

    // Add user message
    messages.push({
      role: 'user',
      content: userContent,
      id: `message-${i * 2}`,
      threadId,
      createdAt: new Date(startTime + i * 2000), // Each pair 2 seconds apart
      type: 'text',
    });

    // Determine if this assistant message should include a tool call
    const includeTool = i > 0 && i % toolFrequency === 0;
    const toolIndex = includeTool ? (i / toolFrequency) % toolNames.length : -1;
    const toolName = includeTool ? toolNames[toolIndex] : '';

    // Create assistant message
    if (includeTool) {
      // Assistant message with tool call
      messages.push({
        role: 'assistant',
        content: [
          { type: 'text', text: `Using ${toolName} tool:` },
          {
            type: 'tool-call',
            toolCallId: `tool-${i}`,
            toolName,
            args: toolArgs[toolName as keyof typeof toolArgs] || {},
          },
        ],
        id: `tool-call-${i * 2 + 1}`,
        threadId,
        createdAt: new Date(startTime + i * 2000 + 1000), // 1 second after user message
        type: 'tool-call',
      });
      messages.push({
        role: 'tool',
        type: `tool-result`,
        id: `tool-result-${i * 2 + 1}`,
        createdAt: new Date(startTime + i * 2000 + 1100),
        threadId,
        content: [
          {
            type: 'tool-result',
            result: toolResults[toolName as keyof typeof toolResults] || {},
            toolCallId: `tool-${i}`,
            toolName,
          },
        ],
      });
    } else {
      // Regular assistant text message
      messages.push({
        role: 'assistant',
        content: Array(15).fill(words).flat().join(' '), // ~60 tokens
        id: `message-${i * 2 + 1}`,
        threadId,
        createdAt: new Date(startTime + i * 2000 + 1000), // 1 second after user message
        type: 'text',
      });
    }
  }

  if (messages.at(-1)!.type === `tool-result`) {
    const userContent = Array(25).fill(words).flat().join(' '); // ~100 tokens
    messages.push({
      role: 'user',
      content: userContent,
      id: `message-${messages.length + 1 * 2}`,
      threadId,
      createdAt: new Date(startTime + messages.length + 1 * 2000), // Each pair 2 seconds apart
      type: 'text',
    });
  }

  return messages;
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
