import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { MastraMessageV1 } from '@mastra/core/memory';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import type { ToolCallPart } from 'ai';
import { config } from 'dotenv';
import type { JSONSchema7 } from 'json-schema';
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

function extractUserData(obj: any) {
  // Remove common schema keys
  const { type, properties, required, additionalProperties, $schema, ...data } = obj;
  return data;
}

config({ path: '.env.test' });

describe('Working Memory Tests', () => {
  let memory: Memory;
  let thread: any;
  let storage: LibSQLStore;
  let vector: LibSQLVector;

  describe('Working Memory Test with Template', () => {
    beforeEach(async () => {
      // Create a new unique database file in the temp directory for each test
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');
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
      const systemInstruction = await memory.getSystemMessage({ threadId: thread.id });
      expect(systemInstruction).not.toBeNull();
      if (systemInstruction) {
        // Should match our Markdown template
        expect(systemInstruction).toContain('# User Information');
        expect(systemInstruction).toContain('First Name');
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
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');

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

  describe('Working Memory with agent memory', () => {
    let agent: Agent;
    let thread: any;
    let memory: Memory;

    beforeEach(async () => {
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');
      storage = new LibSQLStore({
        url: `file:${dbPath}`,
      });

      memory = new Memory({
        storage,
        options: {
          workingMemory: {
            enabled: true,
            schema: z.object({
              favouriteAnimal: z.string(),
            }),
          },
          lastMessages: 1,
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
      expect(await memory.getWorkingMemory({ threadId: thread.id })).toBeNull();
      agent = new Agent({
        name: 'Memory Test Agent',
        instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
        model: openai('gpt-4o'),
        memory,
      });
    });

    it('should remember information from working memory in subsequent calls', async () => {
      const thread = await memory.saveThread({
        thread: createTestThread('Remembering Test'),
      });

      // First call to establish a fact in working memory
      await agent.generate('My favorite animal is the majestic wolf.', {
        threadId: thread.id,
        resourceId,
      });

      // Verify it's in the working memory
      const workingMemoryAfterFirstCall = await memory.getWorkingMemory({ threadId: thread.id });
      expect(workingMemoryAfterFirstCall).not.toBeNull();
      if (workingMemoryAfterFirstCall) {
        expect(workingMemoryAfterFirstCall.toLowerCase()).toContain('wolf');
      }

      // add messages to the thread
      await agent.generate('How are you doing?', {
        threadId: thread.id,
        resourceId,
      });

      // third call to see if the agent remembers the fact
      const response = await agent.generate('What is my favorite animal?', {
        threadId: thread.id,
        resourceId,
      });

      expect(response.text.toLowerCase()).toContain('wolf');
    });

    describe('Working Memory with Schema', () => {
      let agent: Agent;
      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');
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

        expect(await memory.getWorkingMemory({ threadId: thread.id })).toBeNull();

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
        expect(extractUserData(wmObj)).toMatchObject(validMemory);
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
        expect(extractUserData(wmObj)).toMatchObject(second);
      });

      // Skip this for now it's an edge case where an agent updates the working memory based off of the
      // message history.
      it.skip('should not update working from message history', async () => {
        const newThread = await memory.saveThread({
          thread: createTestThread('Test111'),
        });
        const first = { city: 'Toronto', temperature: 80 };
        const generateOptions = {
          memory: {
            resource: resourceId,
            thread: newThread.id,
            options: {
              lastMessages: 0,
              semanticRecall: undefined,
              workingMemory: {
                enabled: true,
                schema: z.object({
                  city: z.string(),
                  temperature: z.number().optional(),
                }),
              },
              threads: {
                generateTitle: false,
              },
            },
          },
        };
        await agent.generate('Now I am in Toronto and it is 80 degrees', generateOptions);

        await agent.generate('how are you doing?', generateOptions);

        const firstWorkingMemory = await memory.getWorkingMemory({ threadId: newThread.id });
        const wm = typeof firstWorkingMemory === 'string' ? JSON.parse(firstWorkingMemory) : firstWorkingMemory;
        const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;

        expect(wmObj).toMatchObject(first);

        const updatedThread = await memory.getThreadById({ threadId: newThread.id });
        if (!updatedThread) {
          throw new Error('Thread not found');
        }
        // Update thread metadata with new working memory
        await memory.saveThread({
          thread: {
            ...updatedThread,
            metadata: {
              ...(updatedThread.metadata || {}),
              workingMemory: { city: 'Waterloo', temperature: 78 },
            },
          },
          memoryConfig: generateOptions.memory.options,
        });

        // This should not update the working memory
        await agent.generate('how are you doing?', generateOptions);

        const result = await agent.generate('Can you tell me where I am?', generateOptions);

        expect(result.text).toContain('Waterloo');
        const secondWorkingMemory = await memory.getWorkingMemory({ threadId: newThread.id });
        expect(secondWorkingMemory).toMatchObject({ city: 'Waterloo', temperature: 78 });
      });
    });
  });

  describe('Working Memory with JSONSchema7', () => {
    let agent: Agent;
    let thread: any;
    let memory: Memory;

    beforeEach(async () => {
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-jsonschema-test-${Date.now()}`)), 'test.db');
      storage = new LibSQLStore({
        url: `file:${dbPath}`,
      });
      vector = new LibSQLVector({
        connectionUrl: `file:${dbPath}`,
      });

      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          city: { type: 'string' },
          preferences: {
            type: 'object',
            properties: {
              theme: { type: 'string' },
              notifications: { type: 'boolean' },
            },
          },
        },
        required: ['name', 'city'],
      };

      memory = new Memory({
        storage,
        vector,
        embedder: fastembed,
        options: {
          workingMemory: {
            enabled: true,
            schema: jsonSchema,
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
        thread: createTestThread('JSONSchema7 Working Memory Test Thread'),
      });

      // Verify initial working memory is empty
      expect(await memory.getWorkingMemory({ threadId: thread.id })).toBeNull();

      agent = new Agent({
        name: 'JSONSchema Memory Test Agent',
        instructions: 'You are a helpful AI agent. Always update working memory with user information.',
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

    it('should accept JSONSchema7 in working memory configuration', async () => {
      // Test that we can create a Memory instance with JSONSchema7 schema
      const jsonSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          testField: { type: 'string' },
        },
        required: ['testField'],
      };

      const testMemory = new Memory({
        storage,
        options: {
          workingMemory: {
            enabled: true,
            schema: jsonSchema,
          },
        },
      });

      // Get the working memory template
      const template = await testMemory.getWorkingMemoryTemplate({
        memoryConfig: {
          workingMemory: {
            enabled: true,
            schema: jsonSchema,
          },
        },
      });

      expect(template).not.toBeNull();
      expect(template?.format).toBe('json');
      expect(template?.content).toContain('testField');
      expect(template?.content).toContain('string');
    });

    it('should accept valid working memory updates matching the JSONSchema7', async () => {
      await agent.generate(
        'Hi, my name is John Doe, I am 30 years old and I live in Boston. I prefer dark theme and want notifications enabled.',
        {
          threadId: thread.id,
          resourceId,
        },
      );

      const wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      const userData = extractUserData(wmObj);

      expect(userData.name).toBe('John Doe');
      expect(userData.age).toBe(30);
      expect(userData.city).toBe('Boston');
    });

    it('should handle required and optional fields correctly with JSONSchema7', async () => {
      // Test with only required fields
      await agent.generate('My name is Jane Smith and I live in Portland.', {
        threadId: thread.id,
        resourceId,
      });

      const wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      const userData = extractUserData(wmObj);

      expect(userData.name).toBe('Jane Smith');
      expect(userData.city).toBe('Portland');
      // Age is not required, so it might not be set
    });

    it('should update working memory progressively with JSONSchema7', async () => {
      // First message with partial info
      await agent.generate('Hi, I am Alex and I live in Miami.', {
        threadId: thread.id,
        resourceId,
      });

      let wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      let wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      let wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      let userData = extractUserData(wmObj);

      expect(userData.name).toBe('Alex');
      expect(userData.city).toBe('Miami');

      // Second message adding more info
      await agent.generate('I am 25 years old.', {
        threadId: thread.id,
        resourceId,
      });

      wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      userData = extractUserData(wmObj);

      expect(userData.name).toBe('Alex');
      expect(userData.city).toBe('Miami');
      expect(userData.age).toBe(25);
    });

    it('should persist working memory across multiple interactions with JSONSchema7', async () => {
      // Set initial data
      await agent.generate('My name is Sarah Wilson, I am 28 and live in Seattle.', {
        threadId: thread.id,
        resourceId,
      });

      // Verify working memory is set
      let wmRaw = await memory.getWorkingMemory({ threadId: thread.id });
      let wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
      let wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
      let userData = extractUserData(wmObj);
      expect(userData.name).toBe('Sarah Wilson');

      // Ask a question that should use the working memory
      const response = await agent.generate('What is my name and where do I live?', {
        threadId: thread.id,
        resourceId,
      });

      // The response should contain the information from working memory
      expect(response.text.toLowerCase()).toContain('sarah');
      expect(response.text.toLowerCase()).toContain('seattle');
    });
  });

  describe('Resource-Scoped Working Memory Tests', () => {
    beforeEach(async () => {
      // Create a new unique database file in the temp directory for each test
      const dbPath = join(await mkdtemp(join(tmpdir(), `memory-resource-working-test-`)), 'test.db');
      console.log('dbPath', dbPath);

      storage = new LibSQLStore({
        url: `file:${dbPath}`,
      });
      vector = new LibSQLVector({
        connectionUrl: `file:${dbPath}`,
      });

      // Create memory instance with resource-scoped working memory enabled
      memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'resource',
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
        thread: createTestThread('Resource Working Memory Test Thread'),
      });
    });

    afterEach(async () => {
      //@ts-ignore
      await storage.client.close();
      //@ts-ignore
      await vector.turso.close();
    });

    it('should store working memory at resource level', async () => {
      // Update working memory using the updateWorkingMemory method
      const workingMemoryData = `# User Information
- **First Name**: John
- **Last Name**: Doe
- **Location**: New York
- **Interests**: AI, Machine Learning
`;

      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId,
        workingMemory: workingMemoryData,
      });

      // Get working memory and verify it's stored at resource level
      const retrievedWorkingMemory = await memory.getWorkingMemory({
        threadId: thread.id,
        resourceId,
      });

      expect(retrievedWorkingMemory).toBe(workingMemoryData);
    });

    it('should share working memory across multiple threads for the same resource', async () => {
      // Create a second thread for the same resource
      const thread2 = await memory.saveThread({
        thread: createTestThread('Second Resource Working Memory Test Thread'),
      });

      // Update working memory from first thread
      const workingMemoryData = `# User Information
- **First Name**: Alice
- **Last Name**: Smith
- **Location**: California
- **Interests**: Data Science, Python
`;

      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId,
        workingMemory: workingMemoryData,
      });

      // Retrieve working memory from second thread
      const retrievedFromThread2 = await memory.getWorkingMemory({
        threadId: thread2.id,
        resourceId,
      });

      expect(retrievedFromThread2).toBe(workingMemoryData);
    });

    it('should update working memory across all threads when updated from any thread', async () => {
      // Create multiple threads for the same resource
      const thread2 = await memory.saveThread({
        thread: createTestThread('Second Thread'),
      });
      const thread3 = await memory.saveThread({
        thread: createTestThread('Third Thread'),
      });

      // Set initial working memory from thread1
      const initialWorkingMemory = `# User Information
- **First Name**: Bob
- **Last Name**: Johnson
- **Location**: Texas
- **Interests**: Software Development
`;

      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId,
        workingMemory: initialWorkingMemory,
      });

      // Update working memory from thread2
      const updatedWorkingMemory = `# User Information
- **First Name**: Bob
- **Last Name**: Johnson
- **Location**: Florida
- **Interests**: Software Development, Travel
`;

      await memory.updateWorkingMemory({
        threadId: thread2.id,
        resourceId,
        workingMemory: updatedWorkingMemory,
      });

      // Verify all threads see the updated working memory
      const wmFromThread1 = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
      const wmFromThread2 = await memory.getWorkingMemory({ threadId: thread2.id, resourceId });
      const wmFromThread3 = await memory.getWorkingMemory({ threadId: thread3.id, resourceId });

      expect(wmFromThread1).toBe(updatedWorkingMemory);
      expect(wmFromThread2).toBe(updatedWorkingMemory);
      expect(wmFromThread3).toBe(updatedWorkingMemory);
    });

    it('should handle JSON format correctly for resource-scoped working memory', async () => {
      const workingMemoryData = `{"name":"Charlie","age":30,"city":"Seattle"}`;

      await memory.updateWorkingMemory({
        threadId: thread.id,
        resourceId,
        workingMemory: workingMemoryData,
      });

      // Test JSON format retrieval
      const retrievedAsJson = await memory.getWorkingMemory({
        threadId: thread.id,
        resourceId,
      });

      expect(retrievedAsJson).toBe(`{"name":"Charlie","age":30,"city":"Seattle"}`);

      // Test default format retrieval
      const retrievedDefault = await memory.getWorkingMemory({
        threadId: thread.id,
        resourceId,
      });

      expect(retrievedDefault).toBe(workingMemoryData);
    });

    it('should verify storage adapter support for resource working memory', async () => {
      // This test would require a mock storage adapter that doesn't support resource working memory
      // For now, we'll just verify that LibSQL supports it
      expect(storage.supports.resourceWorkingMemory).toBe(true);
    });
  });
});
