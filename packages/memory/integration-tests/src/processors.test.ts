import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { LibSQLStore } from '@mastra/core/storage/libsql';

describe('Memory with Processors', () => {
  let memory: Memory;
  let storage: LibSQLStore;

  beforeAll(() => {
    // Create a single in-memory database for all tests
    storage = new LibSQLStore({
      url: 'file::memory:?cache=shared',
    });
    
    // Initialize memory with the in-memory database
    memory = new Memory({
      storage
    });
  });

  afterAll(async () => {
    // Clean up
    if (storage) {
      await storage.close?.();
    }
  });

  it('should apply TokenLimiter when retrieving messages', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'TokenLimiter Test Thread',
    });

    // Create messages (10 messages, 10 tokens each = 100 tokens total)
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push({
        role: 'user',
        content: `Message ${i}`,
        id: `token-${i}`,
        threadId: thread.id,
        createdAt: new Date(Date.now() + i * 1000), // Each message is 1 second after the previous
      });
    }

    // Save messages
    await memory.saveMessages({ messages });

    // Get messages with a token limit of 50 (should get ~5 messages)
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 10 }, // Try to get all 10 messages
      threadConfig: {
        processors: [new TokenLimiter(50)] // Limit to 50 tokens
      }
    });

    // We should have messages limited by token count
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(10);
    
    // And they should be the most recent ones
    const msgIds = result.messages
      .map(m => (m as any).id)
      .sort();
    
    // Verify we have some of the messages
    expect(msgIds.length).toBeGreaterThan(0);
  });

  it('should apply ToolCallFilter when retrieving messages', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'ToolFilter Test Thread',
    });

    // Add a message with text
    const textMessage = {
      role: 'user',
      content: 'Hello world',
      id: 'tool-test-text',
      threadId: thread.id,
      createdAt: new Date(),
    };

    // Add a message with a tool call
    const toolCallMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Using weather tool:' },
        { 
          type: 'tool-call', 
          id: 'tool-call-1', 
          name: 'weather',
          args: { location: 'New York' } 
        }
      ],
      id: 'tool-test-call',
      threadId: thread.id,
      createdAt: new Date(),
    };

    // Save messages
    await memory.saveMessages({ messages: [textMessage, toolCallMessage] });

    // Get messages with a tool filter
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 10 },
      threadConfig: {
        processors: [new ToolCallFilter({ exclude: ['weather'] })]
      }
    });

    // We should only have the text message
    expect(result.messages.length).toBe(1);
    expect((result.messages[0] as any).id).toBe('tool-test-text');
  });

  it('should apply multiple processors in order', async () => {
    // Create a thread
    const thread = await memory.createThread({
      title: 'Multiple Processors Test Thread',
    });

    // Add messages with different tools
    const messages = [
      {
        role: 'user',
        content: 'Hello world',
        id: 'multi-text-1',
        threadId: thread.id,
        createdAt: new Date(Date.now() - 5000),
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Using weather tool:' },
          { 
            type: 'tool-call', 
            id: 'multi-tool-1', 
            name: 'weather',
            args: { location: 'New York' } 
          }
        ],
        id: 'multi-weather',
        threadId: thread.id,
        createdAt: new Date(Date.now() - 4000),
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Using calculator tool:' },
          { 
            type: 'tool-call', 
            id: 'multi-tool-2', 
            name: 'calculator',
            args: { expression: '2+2' } 
          }
        ],
        id: 'multi-calc',
        threadId: thread.id,
        createdAt: new Date(Date.now() - 3000),
      },
      {
        role: 'user',
        content: 'Thanks!',
        id: 'multi-text-2',
        threadId: thread.id,
        createdAt: new Date(Date.now() - 2000),
      },
    ];

    // Save messages
    await memory.saveMessages({ messages });

    // Apply multiple processors: first remove weather tool calls, then limit to 2 messages
    const result = await memory.query({
      threadId: thread.id,
      selectBy: { last: 10 },
      threadConfig: {
        processors: [
          new ToolCallFilter({ exclude: ['weather'] }),
          // Limit tokens to a relatively small amount
          new TokenLimiter(50)
        ]
      }
    });

    // We should have fewer messages after filtering
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(4);
    
    // And they should exclude weather messages
    const weatherMsgIds = result.messages
      .filter(m => (m as any).id.includes('weather'))
      .map(m => (m as any).id);
    expect(weatherMsgIds.length).toBe(0);
  });
}); 