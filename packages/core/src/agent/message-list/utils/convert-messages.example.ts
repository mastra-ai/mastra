/**
 * Example usage of the convertMessages utility
 */
import type * as AIV4 from 'ai';
import type * as AIV5 from 'ai-v5';
import { convertMessages } from './convert-messages';

// Example 1: Convert AI SDK v5 UI messages to v4 Core messages
const v5UIMessages: AIV5.UIMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    parts: [{ type: 'text', text: 'Hello, can you help me?' }],
  },
  {
    id: 'msg-2',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Of course! What do you need help with?' },
      {
        type: 'tool' as const,
        state: 'partial-call',
        id: 'tool-1',
        name: 'searchDocs',
        input: { query: 'user guides' },
      } as AIV5.UIMessage['parts'][number],
    ],
  },
];

// Convert to AI SDK v4 Core format
const v4CoreMessages = convertMessages(v5UIMessages).to('AIV4.Core');
console.log('V4 Core Messages:', v4CoreMessages);

// Example 2: Convert database messages (Mastra V2) to AI SDK v5 UI messages
const dbMessages = [
  {
    id: 'db-msg-1',
    role: 'user' as const,
    createdAt: new Date(),
    content: {
      format: 2 as const,
      parts: [{ type: 'text', text: 'What is the weather today?' }],
      content: 'What is the weather today?',
    },
  },
];

const v5UIMessagesFromDB = convertMessages(dbMessages).to('AIV5.UI');
console.log('V5 UI Messages from DB:', v5UIMessagesFromDB);

// Example 3: Convert any format to Mastra's internal V2 format for storage
const mixedMessages = [
  { role: 'user', content: 'Simple string message' },
  {
    id: 'v4-msg',
    role: 'assistant' as const,
    content: 'I can help with that!',
  },
];

const mastraV2Messages = convertMessages(mixedMessages).to('Mastra.V2');
console.log('Mastra V2 Messages for storage:', mastraV2Messages);

// Example 4: Convert AI SDK v4 UI messages to v5 Model messages (for LLM prompts)
const v4UIMessages: AIV4.UIMessage[] = [
  {
    id: 'ui-1',
    role: 'system',
    content: 'You are a helpful assistant.',
    parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
  },
  {
    id: 'ui-2',
    role: 'user',
    content: 'Tell me a joke',
    parts: [{ type: 'text', text: 'Tell me a joke' }],
  },
];

const v5ModelMessages = convertMessages(v4UIMessages).to('AIV5.Model');
console.log('V5 Model Messages for LLM:', v5ModelMessages);

/**
 * Available output formats:
 * - 'Mastra.V2': Current database storage format (AI SDK v4 compatible)
 * - 'AIV4.UI': AI SDK v4 UIMessage format
 * - 'AIV4.Core': AI SDK v4 CoreMessage format (for LLM prompts)
 * - 'AIV5.UI': AI SDK v5 UIMessage format
 * - 'AIV5.Model': AI SDK v5 ModelMessage format (for LLM prompts)
 */

export {};
