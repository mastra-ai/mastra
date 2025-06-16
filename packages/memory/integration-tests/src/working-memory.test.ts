import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import type { MastraMessageV1 } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import type { ToolCallPart } from 'ai';
import dotenv from 'dotenv';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

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

const createTestMessage = (threadId: string, content: string, role: 'user' | 'assistant' = 'user'): MastraMessageV1 => {
  messageCounter++;
  return {
    id: randomUUID(),
    threadId,
    content,
    role,
    type: 'text',
    createdAt: new Date(Date.now() + messageCounter * 1000),
    resourceId,
  };
};

dotenv.config({ path: '.env.test' });

describe('Working Memory Tests', () => {
  let memory: Memory;
  let thread: any;
  let storage: LibSQLStore;
  let vector: LibSQLVector;

  describe('Working Memory Test with Template', () => {
    beforeEach(async () => {
      // Create a new unique database file in the temp directory for each test
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-`)), 'test.db');
      console.log('dbPath', dbPath);

      storage = new LibSQLStore({
        url: `file:${dbPath}`,
      });
      vector = new LibSQLVector({
        connectionUrl: `file:${dbPath}`,
      });

      // Create memory instance with working memory enabled
      memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            template: `# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Interests**: 
`,
          },
          lastMessages: 10,
          semanticRecall: {
            topK: 3,
            messageRange: 2,
          },
          threads: {
            generateTitle: false,
          },
        },
        storage,
        vector,
        embedder: fastembed,
      });
      // Reset message counter
      messageCounter = 0;
      // Create a new thread for each test
      thread = await memory.saveThread({
        thread: createTestThread('Working Memory Test Thread'),
      });
    });

    afterEach(async () => {
      //@ts-ignore
      await storage.client.close();
      //@ts-ignore
      await vector.turso.close();
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
      const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        // Check for specific Markdown format
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('**First Name**: Tyler');
        expect(workingMemory).toContain('**Location**: San Francisco');
      }
    });

    it('should initialize with default working memory template', async () => {
      const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        // Should match our Markdown template
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('First Name');
      }
    });

    it('should hide working memory tags in remembered messages', async () => {
      const messages = [
        createTestMessage(thread.id, 'Hi, my name is John'),
        createTestMessage(
          thread.id,
          `Hello John!
<working_memory>
# User Information
- **First Name**: John
- **Last Name**: 
- **Location**: 
- **Interests**: 
</working_memory>`,
          'assistant',
        ),
      ];

      await memory.saveMessages({ messages, format: 'v2' });

      const remembered = await memory.rememberMessages({
        threadId: thread.id,
        config: { lastMessages: 10 },
      });

      // Working memory tags should be stripped from the messages
      expect(remembered.messages[1].content).not.toContain('<working_memory>');
      expect(remembered.messages[1].content).toContain('Hello John!');
    });

    it('should respect working memory enabled/disabled setting', async () => {
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-`)), 'test.db');

      // Create memory instance with working memory disabled
      const disabledMemory = new Memory({
        storage: new LibSQLStore({
          url: `file:${dbPath}`,
        }),
        vector: new LibSQLVector({
          connectionUrl: `file:${dbPath}`,
        }),
        embedder: openai.embedding('text-embedding-3-small'),
        options: {
          workingMemory: {
            enabled: false,
            template: `# User Information
- **First Name**: 
- **Last Name**:
`,
          },
          lastMessages: 10,
          semanticRecall: {
            topK: 3,
            messageRange: 2,
          },
          threads: {
            generateTitle: false,
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
          `Hello John!
<working_memory>
# User Information
- **First Name**: John
- **Last Name**: 
</working_memory>`,
          'assistant',
        ),
      ];

      await disabledMemory.saveMessages({ messages, format: 'v2' });

      // Working memory should be null when disabled
      const workingMemory = await disabledMemory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).toBeNull();

      // Thread metadata should not contain working memory
      const updatedThread = await disabledMemory.getThreadById({ threadId: thread.id });
      expect(updatedThread?.metadata?.workingMemory).toBeUndefined();
    });

    it('should handle LLM responses with working memory using tool calls', async () => {
      const agent = new Agent({
        name: 'Memory Test Agent',
        instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
        model: openai('gpt-4o'),
        memory,
      });

      const thread = await memory.createThread(createTestThread(`Tool call working memory test`));

      await agent.generate('Hi, my name is Tyler and I live in San Francisco', {
        threadId: thread.id,
        resourceId,
      });

      const workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        // Check for specific Markdown format
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('**First Name**: Tyler');
        expect(workingMemory).toContain('**Location**: San Francisco');
      }
    });

    it("shouldn't pollute context with working memory tool call args, only the system instruction working memory should exist", async () => {
      const agent = new Agent({
        name: 'Memory Test Agent',
        instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
        model: openai('gpt-4o'),
        memory,
      });

      const thread = await memory.createThread(createTestThread(`Tool call working memory context pollution test`));

      await agent.generate('Hi, my name is Tyler and I live in a submarine under the sea', {
        threadId: thread.id,
        resourceId,
      });

      let workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('**First Name**: Tyler');
        expect(workingMemory?.toLowerCase()).toContain('**location**:');
        expect(workingMemory?.toLowerCase()).toContain('submarine under the sea');
      }

      await agent.generate('I changed my name to Jim', {
        threadId: thread.id,
        resourceId,
      });

      workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('**First Name**: Jim');
        expect(workingMemory?.toLowerCase()).toContain('**location**:');
        expect(workingMemory?.toLowerCase()).toContain('submarine under the sea');
      }

      await agent.generate('I moved to Vancouver Island', {
        threadId: thread.id,
        resourceId,
      });

      workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('**First Name**: Jim');
        expect(workingMemory).toContain('**Location**: Vancouver Island');
      }

      const history = await memory.query({
        threadId: thread.id,
        resourceId,
        selectBy: {
          last: 20,
        },
      });

      const memoryArgs: string[] = [];

      for (const message of history.messages) {
        if (message.role === `assistant`) {
          for (const part of message.content) {
            if (typeof part === `string`) continue;
            if (part.type === `tool-call` && part.toolName === `updateWorkingMemory`) {
              memoryArgs.push((part.args as any).memory);
            }
          }
        }
      }

      expect(memoryArgs).not.toContain(`Tyler`);
      expect(memoryArgs).not.toContain('submarine under the sea');
      expect(memoryArgs).not.toContain('Jim');
      expect(memoryArgs).not.toContain('Vancouver Island');
      expect(memoryArgs).toEqual([]);

      workingMemory = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemory).not.toBeNull();
      if (workingMemory) {
        // Format-specific assertion that checks for Markdown format
        expect(workingMemory).toContain('# User Information');
        expect(workingMemory).toContain('**First Name**: Jim');
        expect(workingMemory).toContain('**Location**: Vancouver Island');
      }
    });

    it('should remove tool-call/tool-result messages with toolName "updateWorkingMemory"', async () => {
      const threadId = thread.id;
      const messages = [
        createTestMessage(threadId, 'User says something'),
        // Pure tool-call message (should be removed)
        {
          id: randomUUID(),
          threadId,
          role: 'assistant',
          type: 'tool-call',
          content: [
            {
              type: 'tool-call',
              toolName: 'updateWorkingMemory',
              // ...other fields as needed
            },
          ],
          toolNames: ['updateWorkingMemory'],
          createdAt: new Date(),
          resourceId,
        },
        // Mixed content: tool-call + text (tool-call part should be filtered, text kept)
        {
          id: randomUUID(),
          threadId,
          role: 'assistant',
          type: 'text',
          content: [
            {
              type: 'tool-call',
              toolName: 'updateWorkingMemory',
              args: { memory: 'should not persist' },
            },
            {
              type: 'text',
              text: 'Normal message',
            },
          ],
          createdAt: new Date(),
          resourceId,
        },
        // Pure text message (should be kept)
        {
          id: randomUUID(),
          threadId,
          role: 'assistant',
          type: 'text',
          content: 'Another normal message',
          createdAt: new Date(),
          resourceId,
        },
      ];

      // Save messages
      const saved = await memory.saveMessages({ messages: messages as MastraMessageV1[], format: 'v2' });

      // Should not include any updateWorkingMemory tool-call messages (pure or mixed)
      expect(
        saved.some(
          m =>
            (m.type === 'tool-call' || m.type === 'tool-result') &&
            Array.isArray(m.content.parts) &&
            m.content.parts.some(
              c => c.type === 'tool-invocation' && c.toolInvocation.toolName === `updateWorkingMemory`,
            ),
        ),
      ).toBe(false);

      // Mixed content message: should only keep the text part
      const assistantMessages = saved.filter(m => m.role === 'assistant');
      expect(
        assistantMessages.every(m => {
          // TODO: seems like saveMessages says it returns MastraMessageV2 but it's returning V1
          return JSON.stringify(m).includes(`updateWorkingMemory`);
        }),
      ).toBe(false);
      // working memory should not be present
      expect(
        saved.some(
          m =>
            (m.type === 'tool-call' || m.type === 'tool-result') &&
            Array.isArray(m.content) &&
            m.content.some(c => (c as ToolCallPart).toolName === 'updateWorkingMemory'),
        ),
      ).toBe(false);

      // TODO: again seems like we're getting V1 here but types say V2
      // It actually should return V1 for now (CoreMessage compatible)

      // Pure text message should be present
      expect(saved.some(m => m.content.content === 'Another normal message')).toBe(true);
      // User message should be present
      expect(
        saved.some(m => typeof m.content.content === 'string' && m.content.content.includes('User says something')),
      ).toBe(true);
    });
  });

  describe('Working Memory with Schema', () => {
    let agent: Agent;
    beforeEach(async () => {
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-`)), 'test.db');
      storage = new LibSQLStore({
        url: `file:${dbPath}`,
      });
      vector = new LibSQLVector({
        connectionUrl: `file:${dbPath}`,
      });

      memory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          workingMemory: {
            enabled: true,
            schema: z.object({
              city: z.string(),
              temperature: z.number().optional(),
            }),
          },
          lastMessages: 10,
          semanticRecall: {
            topK: 3,
            messageRange: 2,
          },
          threads: {
            generateTitle: false,
          },
        },
      });
      // Reset message counter
      messageCounter = 0;

      // Create a new thread for each test
      thread = await memory.saveThread({
        thread: createTestThread('Working Memory Test Thread'),
      });
      agent = new Agent({
        name: 'Memory Test Agent',
        instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
        model: openai('gpt-4o'),
        memory,
      });
    });

    afterEach(async () => {
      //@ts-ignore
      await storage.client.close();
      //@ts-ignore
      await vector.turso.close();
    });

    it('should accept valid working memory updates matching the schema', async () => {
      const validMemory = { city: 'Austin', temperature: 85 };
      await agent.generate('I am in Austin and it is 85 degrees', {
        threadId: thread.id,
        resourceId,
      });

      const wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      expect(wmObj).toMatchObject(validMemory);
    });

    it('should recall the most recent valid schema-based working memory', async () => {
      const second = { city: 'Denver', temperature: 75 };
      await agent.generate('Now I am in Seattle and it is 60 degrees', {
        threadId: thread.id,
        resourceId,
      });
      await agent.generate('Now I am in Denver and it is 75 degrees', {
        threadId: thread.id,
        resourceId,
      });

      const wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      expect(wmObj).toMatchObject(second);
    });
  });
});
