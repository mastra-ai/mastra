import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai';
import type { MessageType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { DefaultStorage } from '@mastra/core/storage/libsql';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe, expect, it, beforeEach, afterAll } from 'vitest';

const resourceId = 'test-resource';
let messageCounter = 0;

// Test helpers
const createTestThread = (title: string, metadata = {}) => ({
  id: randomUUID(),
  title,
  resourceId,
  metadata,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createTestMessage = (threadId: string, content: string, role: 'user' | 'assistant' = 'user'): MessageType => {
  messageCounter++;
  return {
    id: randomUUID(),
    threadId,
    content,
    role,
    type: 'text',
    createdAt: new Date(Date.now() + messageCounter * 1000),
  };
};

dotenv.config({ path: '.env.test' });

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

describe('Working Memory Tests', () => {
  let memory: Memory;
  let thread: any;

  beforeEach(async () => {
    // Create memory instance with working memory enabled
    memory = new Memory({
      options: {
        workingMemory: {
          enabled: true,
          template: `<user>
  <first_name></first_name>
  <last_name></last_name>
  <location></location>
  <interests></interests>
</user>`,
        },
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
      },
    });

    // Reset message counter
    messageCounter = 0;

    // Create a new thread for each test
    thread = await memory.saveThread({
      thread: createTestThread('Working Memory Test Thread'),
    });
  });

  afterAll(async () => {
    const threads = await memory.getThreadsByResourceId({ resourceId });
    await Promise.all(threads.map(thread => memory.deleteThread(thread.id)));
  });

  it('should handle LLM responses with working memory using OpenAI (test that the working memory prompt works)', async () => {
    const agent = new Agent({
      name: 'Memory Test Agent',
      instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
      model: openai('gpt-4o'),
      memory,
    });

    await agent.generate('Hi, my name is Tyler and I live in San Francisco', {
      threadId: thread.id,
      resourceId,
    });

    // Get working memory
    // @ts-expect-error
    const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
    expect(workingMemory).toContain('<first_name>Tyler</first_name>');
    expect(workingMemory).toContain('<location>San Francisco</location>');
  });

  it('should handle LLM responses with working memory', async () => {
    const messages = [
      createTestMessage(thread.id, 'Hi, my name is Tyler'),
      {
        id: randomUUID(),
        threadId: thread.id,
        role: 'assistant',
        type: 'text',
        content:
          "Hello Tyler! I'll remember your name.\n<working_memory><user><first_name>Tyler</first_name></user></working_memory>",
        createdAt: new Date(),
      },
      createTestMessage(thread.id, 'I live in San Francisco'),
      {
        id: randomUUID(),
        threadId: thread.id,
        role: 'assistant',
        type: 'text',
        content:
          "Great city! I'll update my memory about you.\n<working_memory><user><first_name>Tyler</first_name><location>San Francisco</location></user></working_memory>",
        createdAt: new Date(),
      },
    ] as MessageType[];

    await memory.saveMessages({ messages });

    // Get the working memory
    // @ts-expect-error
    const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
    expect(workingMemory).toContain('<first_name>Tyler</first_name>');
    expect(workingMemory).toContain('<location>San Francisco</location>');

    // Verify the messages are saved without working memory tags
    const remembered = await memory.rememberMessages({
      threadId: thread.id,
      config: { lastMessages: 10 },
    });

    // Check that the working memory was stripped from both assistant responses
    const assistantMessages = remembered.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages[0].content).not.toContain('<working_memory>');
    expect(assistantMessages[0].content).toContain('Hello Tyler!');
    expect(assistantMessages[1].content).not.toContain('<working_memory>');
    expect(assistantMessages[1].content).toContain('Great city!');
  });

  it('should initialize with default working memory template', async () => {
    // @ts-expect-error
    const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
    expect(workingMemory).toContain('<user>');
    expect(workingMemory).toContain('<first_name>');
    expect(workingMemory).toContain('</user>');
  });

  it('should update working memory from assistant messages', async () => {
    const messages = [
      createTestMessage(thread.id, 'Hi, my name is John and I live in New York'),
      createTestMessage(
        thread.id,
        'Nice to meet you! Let me update my memory.\n<working_memory><user><first_name>John</first_name><location>New York</location></user></working_memory>',
        'assistant',
      ),
    ];

    await memory.saveMessages({ messages });

    // Get thread and check metadata
    const updatedThread = await memory.getThreadById({ threadId: thread.id });
    expect(updatedThread?.metadata?.workingMemory).toContain('<first_name>John</first_name>');
    expect(updatedThread?.metadata?.workingMemory).toContain('<location>New York</location>');
  });

  it('should accumulate working memory across multiple messages', async () => {
    // First interaction about name
    await memory.saveMessages({
      messages: [
        createTestMessage(thread.id, 'Hi, my name is John'),
        createTestMessage(
          thread.id,
          'Hello John!\n<working_memory><user><first_name>John</first_name></user></working_memory>',
          'assistant',
        ),
      ],
    });

    // Second interaction about location
    await memory.saveMessages({
      messages: [
        createTestMessage(thread.id, 'I live in New York'),
        createTestMessage(
          thread.id,
          'Great city!\n<working_memory><user><first_name>John</first_name><location>New York</location></user></working_memory>',
          'assistant',
        ),
      ],
    });

    // Third interaction about interests
    await memory.saveMessages({
      messages: [
        createTestMessage(thread.id, 'I love playing tennis'),
        createTestMessage(
          thread.id,
          'Tennis is fun!\n<working_memory><user><first_name>John</first_name><location>New York</location><interests>tennis</interests></user></working_memory>',
          'assistant',
        ),
      ],
    });

    // @ts-expect-error
    const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
    expect(workingMemory).toContain('<first_name>John</first_name>');
    expect(workingMemory).toContain('<location>New York</location>');
    expect(workingMemory).toContain('<interests>tennis</interests>');
  });

  it('should hide working memory tags in remembered messages', async () => {
    const messages = [
      createTestMessage(thread.id, 'Hi, my name is John'),
      createTestMessage(
        thread.id,
        'Hello John!\n<working_memory><user><first_name>John</first_name></user></working_memory>',
        'assistant',
      ),
    ];

    await memory.saveMessages({ messages });

    const remembered = await memory.rememberMessages({
      threadId: thread.id,
      config: { lastMessages: 10 },
    });

    // Working memory tags should be stripped from the messages
    expect(remembered.messages[1].content).not.toContain('<working_memory>');
    expect(remembered.messages[1].content).toContain('Hello John!');
  });

  it('should respect working memory enabled/disabled setting', async () => {
    // Create memory instance with working memory disabled
    const disabledMemory = new Memory({
      storage: new DefaultStorage({
        config: {
          url: 'file:test.db',
        },
      }),
      options: {
        workingMemory: {
          enabled: false,
          template: `<user><first_name></first_name></user>`,
        },
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
      },
    });

    const thread = await disabledMemory.saveThread({
      thread: createTestThread('Disabled Working Memory Thread'),
    });

    const messages = [
      createTestMessage(thread.id, 'Hi, my name is John'),
      createTestMessage(
        thread.id,
        'Hello John!\n<working_memory><user><first_name>John</first_name></user></working_memory>',
        'assistant',
      ),
    ];

    await disabledMemory.saveMessages({ messages });

    // Working memory should be null when disabled
    // @ts-expect-error
    const workingMemory = await disabledMemory.getWorkingMemory({ threadId: thread.id });
    expect(workingMemory).toBeNull();

    // Thread metadata should not contain working memory
    const updatedThread = await disabledMemory.getThreadById({ threadId: thread.id });
    expect(updatedThread?.metadata?.workingMemory).toBeUndefined();
  });

  it('should respect working memory use setting', async () => {
    // Create memory instance with working memory in tool-call mode
    const toolCallMemory = new Memory({
      storage: new DefaultStorage({
        config: {
          url: 'file:test.db',
        },
      }),
      options: {
        workingMemory: {
          enabled: true,
          template: `<user><first_name></first_name><location></location></user>`,
          use: 'tool-call',
        },
        lastMessages: 10,
      },
    });

    const toolCallThread = await toolCallMemory.saveThread({
      thread: createTestThread('Tool Call Working Memory Thread'),
    });

    // Get the system message and verify instructions
    const systemMessage = await toolCallMemory.getSystemMessage({ threadId: toolCallThread.id });
    expect(systemMessage).not.toContain('<working_memory>text</working_memory>');
    expect(systemMessage).toContain('updateWorkingMemory');

    // Test tool-call mode saves working memory
    const toolCallAgent = new Agent({
      name: 'Tool Call Memory Agent',
      instructions: 'You are a helpful AI agent. Always remember user information.',
      model: openai('gpt-4o'),
      memory: toolCallMemory,
    });

    await toolCallAgent.generate('Hi, my name is John and I live in New York', {
      threadId: toolCallThread.id,
      resourceId,
    });

    // Verify working memory was saved in tool-call mode
    const toolCallWorkingMemory = await toolCallMemory.getThreadById({ threadId: toolCallThread.id });
    expect(toolCallWorkingMemory?.metadata?.workingMemory).toContain('<first_name>John</first_name>');
    expect(toolCallWorkingMemory?.metadata?.workingMemory).toContain('<location>New York</location>');

    // Create memory instance with working memory in text-stream mode
    const textStreamMemory = new Memory({
      storage: new DefaultStorage({
        config: {
          url: 'file:test.db',
        },
      }),
      options: {
        workingMemory: {
          enabled: true,
          template: `<user><first_name></first_name><location></location></user>`,
          use: 'text-stream',
        },
        lastMessages: 10,
      },
    });

    const textStreamThread = await textStreamMemory.saveThread({
      thread: createTestThread('Text Stream Working Memory Thread'),
    });

    // Get the system message and verify instructions
    const textStreamSystemMessage = await textStreamMemory.getSystemMessage({ threadId: textStreamThread.id });
    expect(textStreamSystemMessage).toContain('<working_memory>text</working_memory>');
    expect(textStreamSystemMessage).not.toContain('updateWorkingMemory');

    // Test text-stream mode saves working memory
    const textStreamAgent = new Agent({
      name: 'Text Stream Memory Agent',
      instructions: 'You are a helpful AI agent. Always remember user information.',
      model: openai('gpt-4o'),
      memory: textStreamMemory,
    });

    await textStreamAgent.generate('Hi, my name is Tyler and I live in San Francisco', {
      threadId: textStreamThread.id,
      resourceId,
    });

    // Verify working memory was saved in text-stream mode
    const textStreamWorkingMemory = await textStreamMemory.getThreadById({ threadId: textStreamThread.id });
    expect(textStreamWorkingMemory?.metadata?.workingMemory).toContain('<first_name>Tyler</first_name>');
    expect(textStreamWorkingMemory?.metadata?.workingMemory).toContain('<location>San Francisco</location>');
  });

  it('should handle LLM responses with working memory using tool calls', async () => {
    const agent = new Agent({
      name: 'Memory Test Agent',
      instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
      model: openai('gpt-4o'),
      memory: new Memory({
        storage: new DefaultStorage({
          config: {
            url: 'file:test.db',
          },
        }),
        options: {
          workingMemory: {
            enabled: true,
            use: 'tool-call',
          },
          lastMessages: 5,
        },
      }),
    });

    await agent.generate('Hi, my name is Tyler and I live in San Francisco', {
      threadId: thread.id,
      resourceId,
    });

    // Get working memory
    // @ts-expect-error
    const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
    expect(workingMemory).toContain('<first_name>Tyler</first_name>');
    expect(workingMemory).toContain('<location>San Francisco</location>');
  });
});
