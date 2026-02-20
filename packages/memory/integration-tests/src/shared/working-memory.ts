import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { getLLMTestMode } from '@internal/llm-recorder';
import { isV5PlusModel, agentGenerate as baseAgentGenerate, setupDummyApiKeys } from '@internal/test-utils';
import type { MastraModelConfig as TestUtilsModelConfig } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { MastraDBMessage } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it, beforeEach, afterEach, beforeAll } from 'vitest';
import { z } from 'zod';

setupDummyApiKeys(getLLMTestMode(), ['openai']);

// Local wrapper to handle Agent type compatibility
// (Agent has complex generic types that don't play well with the shared helper)
async function agentGenerate(
  agent: Agent,
  message: string | unknown[],
  options: { threadId?: string; resourceId?: string; [key: string]: unknown },
  model: MastraModelConfig,
): Promise<any> {
  return baseAgentGenerate(agent as any, message, options, model as TestUtilsModelConfig);
}

const resourceId = 'test-resource';
let messageCounter = 0;

// Helper function to extract text content from MastraDBMessage
function getTextContent(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (message.content && typeof message.content === 'object') {
    // Handle format 2 (MastraMessageContentV2)
    if (message.content.parts && Array.isArray(message.content.parts)) {
      const textParts = message.content.parts.filter((part: any) => part.type === 'text').map((part: any) => part.text);
      return textParts.join(' ');
    }

    // Handle direct text property
    if (message.content.text) {
      return message.content.text;
    }

    // Handle nested content property
    if (message.content.content && typeof message.content.content === 'string') {
      return message.content.content;
    }
  }

  return '';
}

// Test helpers
const createTestThread = (title: string, metadata = {}) => ({
  id: 'b8f55d05-8b0b-447c-9d49-28e35cdd5db6',
  title,
  resourceId,
  metadata,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createTestMessage = (threadId: string, content: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage => {
  messageCounter++;
  return {
    id: randomUUID(),
    threadId,
    content: {
      format: 2,
      parts: [{ type: 'text', text: content }],
    },
    role,
    type: 'text',
    createdAt: new Date(Date.now() + messageCounter * 1000),
    resourceId,
  } as MastraDBMessage;
};

function extractUserData(obj: any) {
  if (!obj) return obj;
  // Remove common schema keys
  const { type, properties, required, additionalProperties, $schema, ...data } = obj;
  return data;
}

// Helper function at the top of the file (outside the test)
function getErrorDetails(error: any): string | undefined {
  if (!error) return undefined;
  if (error.message) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}

export function getWorkingMemoryTests(model: MastraModelConfig) {
  const modelName = typeof model === 'string' ? model : (model as any).modelId || (model as any).id || 'sdk-model';

  describe(`Working Memory Tests (${modelName})`, () => {
    let memory: Memory;
    let thread: any;
    let storage: LibSQLStore;
    let vector: LibSQLVector;

    describe('Working Memory Test with Template', () => {
      let dbPath: string;
      beforeEach(async () => {
        // Create a new unique database file in the temp directory for each test
        dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');

        storage = new LibSQLStore({
          id: 'working-memory-template-storage',
          url: `file:${dbPath}`,
        });
        vector = new LibSQLVector({
          id: 'working-memory-template-vector',
          url: `file:${dbPath}`,
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
            generateTitle: false,
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
        // @ts-expect-error - accessing client for cleanup
        await storage.client.close();
        // @ts-expect-error - accessing client for cleanup
        await vector.turso.close();

        try {
          await rm(dirname(dbPath), { force: true, recursive: true });
        } catch {}
      });

      it('should handle LLM responses with working memory using OpenAI (test that the working memory prompt works)', async () => {
        const agent = new Agent({
          id: 'memory-test-agent',
          name: 'Memory Test Agent',
          instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
          model,
          memory,
        });

        await agentGenerate(
          agent,
          'Hi, my name is Tyler and I live in San Francisco',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        // Get working memory
        const workingMemory = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(workingMemory).not.toBeNull();
        if (workingMemory) {
          // Check for specific Markdown format
          expect(workingMemory).toContain('# User Information');
          expect(workingMemory).toContain('**First Name**: Tyler');
          expect(workingMemory).toContain('**Location**: San Francisco');
        }
      });

      it('should initialize with default working memory template', async () => {
        const systemInstruction = await memory.getSystemMessage({ threadId: thread.id, resourceId });
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

        await memory.saveMessages({ messages });

        const remembered = await memory.recall({
          threadId: thread.id,
          perPage: 10,
        });

        // Working memory tags should be stripped from the messages
        expect(getTextContent(remembered.messages[1])).not.toContain('<working_memory>');
        expect(getTextContent(remembered.messages[1])).toContain('Hello John!');
      });

      it('should respect working memory enabled/disabled setting', async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');

        // Create memory instance with working memory disabled
        const disabledMemory = new Memory({
          storage: new LibSQLStore({
            id: 'disabled-working-memory-storage',
            url: `file:${dbPath}`,
          }),
          vector: new LibSQLVector({
            id: 'disabled-working-memory-vector',
            url: `file:${dbPath}`,
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
            generateTitle: false,
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

        await disabledMemory.saveMessages({ messages });

        // Working memory should be null when disabled
        const workingMemory = await disabledMemory.getWorkingMemory({ threadId: thread.id });
        expect(workingMemory).toBeNull();

        // Thread metadata should not contain working memory
        const updatedThread = await disabledMemory.getThreadById({ threadId: thread.id });
        expect(updatedThread?.metadata?.workingMemory).toBeUndefined();
      });

      it('should handle LLM responses with working memory using tool calls', async () => {
        const agent = new Agent({
          id: 'memory-test-agent',
          name: 'Memory Test Agent',
          instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
          model,
          memory,
        });

        const thread = await memory.createThread(createTestThread(`Tool call working memory test`));

        await agentGenerate(
          agent,
          'Hi, my name is Tyler and I live in San Francisco',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        const workingMemory = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
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
          id: 'memory-test-agent',
          name: 'Memory Test Agent',
          instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
          model,
          memory,
        });

        const thread = await memory.createThread(createTestThread(`Tool call working memory context pollution test`));

        await agentGenerate(
          agent,
          'Hi, my name is Tyler and I live in a submarine under the sea',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        let workingMemory = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(workingMemory).not.toBeNull();
        if (workingMemory) {
          expect(workingMemory).toContain('# User Information');
          expect(workingMemory).toContain('**First Name**: Tyler');
          expect(workingMemory?.toLowerCase()).toContain('**location**:');
          expect(workingMemory?.toLowerCase()).toContain('submarine under the sea');
        }

        await agentGenerate(
          agent,
          'I changed my name to Jim',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        workingMemory = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(workingMemory).not.toBeNull();
        if (workingMemory) {
          expect(workingMemory).toContain('# User Information');
          expect(workingMemory).toContain('**First Name**: Jim');
          expect(workingMemory?.toLowerCase()).toContain('**location**:');
          expect(workingMemory?.toLowerCase()).toContain('submarine under the sea');
        }

        await agentGenerate(
          agent,
          'I moved to Vancouver Island',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        workingMemory = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(workingMemory).not.toBeNull();
        if (workingMemory) {
          expect(workingMemory).toContain('# User Information');
          expect(workingMemory).toContain('**First Name**: Jim');
          expect(workingMemory).toContain('**Location**: Vancouver Island');
        }

        const history = await memory.recall({
          threadId: thread.id,
          resourceId,
          perPage: 20,
        });

        const memoryArgs: string[] = [];

        for (const message of history.messages) {
          if (message.role === `assistant`) {
            for (const part of message.content.parts) {
              if (part.type === 'tool-invocation' && part.toolInvocation?.toolName === `updateWorkingMemory`) {
                memoryArgs.push(part.toolInvocation.args.memory);
              }
            }
          }
        }

        expect(memoryArgs).not.toContain(`Tyler`);
        expect(memoryArgs).not.toContain('submarine under the sea');
        expect(memoryArgs).not.toContain('Jim');
        expect(memoryArgs).not.toContain('Vancouver Island');
        expect(memoryArgs).toEqual([]);

        workingMemory = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
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
        const messages: MastraDBMessage[] = [
          createTestMessage(threadId, 'User says something'),
          // Pure tool-call message (should be removed)
          {
            id: randomUUID(),
            threadId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: randomUUID(),
                    toolName: 'updateWorkingMemory',
                    args: {},
                    state: 'result',
                    result: {},
                  },
                },
              ],
            },
            createdAt: new Date(),
            resourceId,
          } as MastraDBMessage,
          // Mixed content: tool-call + text (tool-call part should be filtered, text kept)
          {
            id: randomUUID(),
            threadId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: randomUUID(),
                    toolName: 'updateWorkingMemory',
                    args: { memory: 'should not persist' },
                    state: 'result',
                    result: {},
                  },
                },
                {
                  type: 'text',
                  text: 'Normal message',
                },
              ],
            },
            createdAt: new Date(),
            resourceId,
          } as MastraDBMessage,
          // Pure text message (should be kept)
          {
            id: randomUUID(),
            threadId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'text',
                  text: 'Another normal message',
                },
              ],
            },
            createdAt: new Date(),
            resourceId,
          } as MastraDBMessage,
        ];

        // Save messages
        const result = await memory.saveMessages({ messages: messages as MastraDBMessage[] });
        const saved = result.messages;

        // Should not include any updateWorkingMemory tool-call messages (pure or mixed)
        expect(
          saved.some(
            m =>
              Array.isArray(m.content.parts) &&
              m.content.parts.some(
                (c: any) => c.type === 'tool-invocation' && c.toolInvocation?.toolName === `updateWorkingMemory`,
              ),
          ),
        ).toBe(false);

        // Mixed content message: should only keep the text part
        const assistantMessages = saved.filter(m => m.role === 'assistant');
        expect(
          assistantMessages.every(m => {
            return JSON.stringify(m).includes(`updateWorkingMemory`);
          }),
        ).toBe(false);
        // working memory should not be present
        expect(
          saved.some(
            m =>
              Array.isArray(m.content.parts) &&
              m.content.parts.some(
                (c: any) => c.type === 'tool-invocation' && c.toolInvocation?.toolName === 'updateWorkingMemory',
              ),
          ),
        ).toBe(false);

        // Pure text message should be present (check parts array for text)
        expect(
          saved.some(m => m.content.parts?.some((p: any) => p.type === 'text' && p.text === 'Another normal message')),
        ).toBe(true);
        // User message should be present (check parts array for text)
        expect(
          saved.some(m =>
            m.content.parts?.some((p: any) => p.type === 'text' && p.text.includes('User says something')),
          ),
        ).toBe(true);
      });
    });

    describe('Working Memory with agent memory', () => {
      let agent: Agent;
      let thread: any;
      let memory: Memory;
      let storage: LibSQLStore;

      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');
        storage = new LibSQLStore({
          id: 'agent-working-memory-storage',
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
            generateTitle: false,
          },
        });
        // Reset message counter
        messageCounter = 0;

        // Create a new thread for each test
        thread = await memory.saveThread({
          thread: createTestThread('Working Memory Test Thread'),
        });
        expect(await memory.getWorkingMemory({ threadId: thread.id, resourceId })).toBeNull();
        agent = new Agent({
          id: 'memory-test-agent',
          name: 'Memory Test Agent',
          instructions: 'You are a helpful AI agent. Always add working memory tags to remember user information.',
          model,
          memory,
        });
      });

      it('should remember information from working memory in subsequent calls', async () => {
        const thread = await memory.saveThread({
          thread: createTestThread('Remembering Test'),
        });

        // First call to establish a fact in working memory
        await agentGenerate(
          agent,
          'My favorite animal is the majestic wolf.',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        // Verify it's in the working memory
        const workingMemoryAfterFirstCall = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(workingMemoryAfterFirstCall).not.toBeNull();
        if (workingMemoryAfterFirstCall) {
          expect(workingMemoryAfterFirstCall.toLowerCase()).toContain('wolf');
        }

        // add messages to the thread
        await agentGenerate(
          agent,
          'How are you doing?',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        // third call to see if the agent remembers the fact
        const response = await agentGenerate(
          agent,
          'What is my favorite animal?',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        expect(response.text.toLowerCase()).toContain('wolf');
      });

      describe('Working Memory with Schema', () => {
        let agent: Agent;
        let storage: LibSQLStore;
        let vector: LibSQLVector;
        let memory: Memory;
        let thread: any;

        beforeEach(async () => {
          const dbPath = join(await mkdtemp(join(tmpdir(), `memory-working-test-${Date.now()}`)), 'test.db');
          storage = new LibSQLStore({
            id: 'schema-working-memory-storage',
            url: `file:${dbPath}`,
          });
          vector = new LibSQLVector({
            id: 'schema-working-memory-vector',
            url: `file:${dbPath}`,
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
                  temperature: z.number().describe('The number value of the temperature'),
                }),
              },
              lastMessages: 10,
              semanticRecall: {
                topK: 3,
                messageRange: 2,
              },
              generateTitle: false,
            },
          });
          // Reset message counter
          messageCounter = 0;

          // Create a new thread for each test
          thread = await memory.saveThread({
            thread: createTestThread('Working Memory Test Thread'),
          });

          expect(await memory.getWorkingMemory({ threadId: thread.id, resourceId })).toBeNull();

          agent = new Agent({
            id: 'memory-test-agent',
            name: 'Memory Test Agent',
            instructions: `
              You are a helpful AI agent. Always add working memory tags to remember user information.

              Temperature, "temperature" should be reported as a number.
              The location should be labeled "city" and reported as a string.
              `,
            model,
            memory,
          });
        });

        afterEach(async () => {
          // @ts-expect-error - accessing client for cleanup
          await storage.client.close();
          // @ts-expect-error - accessing client for cleanup
          await vector.turso.close();
        });

        it('should accept valid working memory updates matching the schema', async () => {
          const validMemory = { city: 'Austin', temperature: 85 };
          await agentGenerate(
            agent,
            'I am in the city of Austin and it is 85 degrees.',
            {
              threadId: thread.id,
              resourceId,
            },
            model,
          );

          const wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
          const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
          const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
          expect(extractUserData(wmObj)).toMatchObject(validMemory);
        });

        it('should recall the most recent valid schema-based working memory', async () => {
          const second = { city: 'Denver', temperature: 75 };
          await agentGenerate(
            agent,
            'Now I am in Seattle and it is 60 degrees',
            {
              threadId: thread.id,
              resourceId,
              modelSettings: { temperature: 0 },
            },
            model,
          );
          await agentGenerate(
            agent,
            'Now I am in Denver and it is 75 degrees',
            {
              threadId: thread.id,
              resourceId,
              modelSettings: { temperature: 0 },
            },
            model,
          );

          const wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
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
                generateTitle: false,
              },
            },
          };
          await agentGenerate(agent, 'Now I am in Toronto and it is 80 degrees', generateOptions, model);

          await agentGenerate(agent, 'how are you doing?', generateOptions, model);

          const firstWorkingMemory = await memory.getWorkingMemory({ threadId: newThread.id, resourceId });
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
          await agentGenerate(agent, 'how are you doing?', generateOptions, model);

          const result = await agentGenerate(agent, 'Can you tell me where I am?', generateOptions, model);

          expect(result.text).toContain('Waterloo');
          const secondWorkingMemory = await memory.getWorkingMemory({ threadId: newThread.id, resourceId });
          expect(secondWorkingMemory).toMatchObject({ city: 'Waterloo', temperature: 78 });
        });
      });
    });

    describe('Working Memory with JSONSchema7', () => {
      let agent: Agent;
      let thread: any;
      let memory: Memory;
      let storage: LibSQLStore;
      let vector: LibSQLVector;

      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-jsonschema-test-${Date.now()}`)), 'test.db');
        storage = new LibSQLStore({
          id: 'jsonschema7-storage',
          url: `file:${dbPath}`,
        });
        vector = new LibSQLVector({
          id: 'jsonschema7-vector',
          url: `file:${dbPath}`,
        });

        const jsonSchema: JSONSchema7 = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: ['number', 'null'] },
            city: { type: 'string' },
            preferences: {
              type: ['object', 'null'],
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
            generateTitle: false,
          },
        });

        // Reset message counter
        messageCounter = 0;

        // Create a new thread for each test
        thread = await memory.saveThread({
          thread: createTestThread('JSONSchema7 Working Memory Test Thread'),
        });

        // Verify initial working memory is empty
        expect(await memory.getWorkingMemory({ threadId: thread.id, resourceId })).toBeNull();

        agent = new Agent({
          id: 'jsonschema-memory-test-agent',
          name: 'JSONSchema Memory Test Agent',
          instructions: 'You are a helpful AI agent.',
          model,
          memory,
        });
      });

      afterEach(async () => {
        // @ts-expect-error - accessing client for cleanup
        await storage.client.close();
        // @ts-expect-error - accessing client for cleanup
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
        await agentGenerate(
          agent,
          'Hi, my name is John Doe, I am 30 years old and I live in Boston. I prefer dark theme and want notifications enabled.',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        const wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
        const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
        const userData = extractUserData(wmObj);

        expect(userData.name).toBe('John Doe');
        expect(userData.age).toBe(30);
        expect(userData.city).toBe('Boston');
      });

      it('should handle required and optional fields correctly with JSONSchema7', async () => {
        // Test with only required fields
        const _res = await agentGenerate(
          agent,
          'My name is Jane Smith and I live in Portland.',
          {
            threadId: thread.id,
            resourceId,
            maxSteps: 5,
          },
          model,
        );

        const wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        const wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
        const wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
        const userData = extractUserData(wmObj);

        expect(userData.name).toBe('Jane Smith');
        expect(userData.city).toBe('Portland');
        // Age is not required, so it might not be set
      });

      it('should update working memory progressively with JSONSchema7', async () => {
        // First message with partial info
        await agentGenerate(
          agent,
          'Hi, I am Alex and I live in Miami.',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        let wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
        let wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
        let userData = extractUserData(wmObj);

        expect(userData.name).toBe('Alex');
        expect(userData.city).toBe('Miami');

        // Second message adding more info
        await agentGenerate(
          agent,
          'I am 25 years old.',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
        wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
        userData = extractUserData(wmObj);

        expect(userData.name).toBe('Alex');
        expect(userData.city).toBe('Miami');
        expect(userData.age).toBe(25);
      });

      it('should persist working memory across multiple interactions with JSONSchema7', async () => {
        // Set initial data
        await agentGenerate(
          agent,
          'My name is Sarah Wilson, I am 28 and live in Seattle.',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        // Verify working memory is set
        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        let wm = typeof wmRaw === 'string' ? JSON.parse(wmRaw) : wmRaw;
        let wmObj = typeof wm === 'string' ? JSON.parse(wm) : wm;
        let userData = extractUserData(wmObj);
        expect(userData.name).toBe('Sarah Wilson');

        // Ask a question that should use the working memory
        const response = await agentGenerate(
          agent,
          'What is my name and where do I live?',
          {
            threadId: thread.id,
            resourceId,
          },
          model,
        );

        // The response should contain the information from working memory
        expect(response.text.toLowerCase()).toContain('sarah');
        expect(response.text.toLowerCase()).toContain('seattle');
      });
    });

    describe('Resource-Scoped Working Memory Tests', () => {
      let storage: LibSQLStore;
      let vector: LibSQLVector;
      let memory: Memory;
      let thread: any;

      beforeEach(async () => {
        // Create a new unique database file in the temp directory for each test
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-resource-working-test-`)), 'test.db');

        storage = new LibSQLStore({
          id: 'resource-scoped-storage',
          url: `file:${dbPath}`,
        });
        vector = new LibSQLVector({
          id: 'resource-scoped-vector',
          url: `file:${dbPath}`,
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
            generateTitle: false,
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
        // @ts-expect-error - accessing client for cleanup
        await storage.client.close();
        // @ts-expect-error - accessing client for cleanup
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

      it('should initialize working memory when creating new threads for existing resources', async () => {
        // Create first thread and set working memory
        const thread1 = await memory.saveThread({
          thread: createTestThread('First Thread'),
        });

        const workingMemoryData = `# User Information
- **First Name**: David
- **Last Name**: Wilson
- **Location**: Portland
- **Interests**: Music, Photography
`;

        await memory.updateWorkingMemory({
          threadId: thread1.id,
          resourceId,
          workingMemory: workingMemoryData,
        });

        // Create a new thread for the same resource
        const thread2 = await memory.saveThread({
          thread: createTestThread('Second Thread'),
        });

        // The new thread should immediately have access to the existing working memory
        const retrievedMemory = await memory.getWorkingMemory({
          threadId: thread2.id,
          resourceId,
        });

        expect(retrievedMemory).toBe(workingMemoryData);
      });

      describe('Setting Working Memory via Thread Metadata (Resource Scope)', () => {
        it('should set working memory at resource level when creating thread with metadata.workingMemory', async () => {
          const workingMemoryData = `# User Information
- **First Name**: John
- **Last Name**: Doe
- **Location**: New York`;

          const thread = await memory.createThread({
            resourceId,
            metadata: {
              workingMemory: workingMemoryData,
            },
          });

          const retrievedWM = await memory.getWorkingMemory({
            threadId: thread.id,
            resourceId,
          });

          expect(retrievedWM).toBe(workingMemoryData);
        });

        it('should store working memory in resource table, not thread metadata', async () => {
          const workingMemoryData = `# User Info
- Name: Alice
- Email: alice@example.com`;

          const thread = await memory.createThread({
            resourceId,
            metadata: {
              workingMemory: workingMemoryData,
            },
          });

          const memoryStorage = await storage.getStore('memory');

          // Verify it's in the resource table
          const resource = await memoryStorage?.getResourceById({ resourceId });
          expect(resource?.workingMemory).toBe(workingMemoryData);

          // The working memory should come from resource, not thread metadata
          const wmFromResource = await memory.getWorkingMemory({
            threadId: thread.id,
            resourceId,
          });
          expect(wmFromResource).toBe(workingMemoryData);
        });

        it('should share working memory across threads when set via metadata on first thread', async () => {
          const workingMemoryData = `# Shared User Data
- Name: Bob
- Preferences: Dark Mode`;

          // Create first thread with working memory
          const thread1 = await memory.createThread({
            resourceId,
            metadata: {
              workingMemory: workingMemoryData,
            },
          });

          // Create second thread without working memory
          const thread2 = await memory.createThread({
            resourceId,
          });

          // Both threads should see the same working memory
          const wm1 = await memory.getWorkingMemory({ threadId: thread1.id, resourceId });
          const wm2 = await memory.getWorkingMemory({ threadId: thread2.id, resourceId });

          expect(wm1).toBe(workingMemoryData);
          expect(wm2).toBe(workingMemoryData);
        });

        it('should produce same result as updateWorkingMemory for resource scope', async () => {
          const workingMemoryData = `# User Profile
- ID: user-123
- Subscription: Premium`;

          // Method 1: Via metadata (this should work but doesn't)
          const thread1 = await memory.createThread({
            resourceId: 'resource-1',
            metadata: { workingMemory: workingMemoryData },
          });

          // Method 2: Via updateWorkingMemory (this works)
          const thread2 = await memory.createThread({ resourceId: 'resource-2' });
          await memory.updateWorkingMemory({
            threadId: thread2.id,
            resourceId: 'resource-2',
            workingMemory: workingMemoryData,
          });

          const wm1 = await memory.getWorkingMemory({
            threadId: thread1.id,
            resourceId: 'resource-1',
          });
          const wm2 = await memory.getWorkingMemory({
            threadId: thread2.id,
            resourceId: 'resource-2',
          });

          expect(wm1).toBe(wm2);
          expect(wm1).toBe(workingMemoryData);
        });

        it('should update working memory at resource level when updating thread metadata', async () => {
          const initialWM = `# User Data
- Name: Charlie`;

          const thread = await memory.createThread({
            resourceId,
            metadata: { workingMemory: initialWM },
          });

          // Verify initial working memory is set
          const retrievedInitial = await memory.getWorkingMemory({
            threadId: thread.id,
            resourceId,
          });
          expect(retrievedInitial).toBe(initialWM);

          // Update thread metadata with new working memory
          const updatedWM = `# User Data
- Name: Charlie
- Email: charlie@example.com`;

          await memory.updateThread({
            id: thread.id,
            title: thread.title || 'Test Thread',
            metadata: {
              ...thread.metadata,
              workingMemory: updatedWM,
            },
          });

          // Verify working memory was updated in resource table
          const retrievedUpdated = await memory.getWorkingMemory({
            threadId: thread.id,
            resourceId,
          });
          expect(retrievedUpdated).toBe(updatedWM);
        });
      });
    });

    describe('Setting Working Memory via Thread Metadata (Thread Scope)', () => {
      let memory: Memory;
      let storage: LibSQLStore;
      let vector: LibSQLVector;

      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-thread-working-test-`)), 'test.db');

        storage = new LibSQLStore({
          id: 'thread-scoped-metadata-storage',
          url: `file:${dbPath}`,
        });
        vector = new LibSQLVector({
          id: 'thread-scoped-metadata-vector',
          url: `file:${dbPath}`,
        });

        // Create memory instance with thread-scoped working memory
        memory = new Memory({
          options: {
            workingMemory: {
              enabled: true,
              scope: 'thread',
              template: `# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
`,
            },
            lastMessages: 10,
            semanticRecall: {
              topK: 3,
              messageRange: 2,
            },
            generateTitle: false,
          },
          storage,
          vector,
          embedder: fastembed,
        });
      });

      afterEach(async () => {
        // @ts-expect-error - accessing client for cleanup
        await storage.client.close();
        // @ts-expect-error - accessing client for cleanup
        await vector.turso.close();
      });

      it('should set working memory when creating thread with metadata.workingMemory', async () => {
        const workingMemoryData = `# User Information
- **First Name**: Jane
- **Last Name**: Smith
- **Location**: Boston`;

        const thread = await memory.createThread({
          resourceId,
          metadata: {
            workingMemory: workingMemoryData,
          },
        });

        const retrievedWM = await memory.getWorkingMemory({ threadId: thread.id });
        expect(retrievedWM).toBe(workingMemoryData);
      });

      it('should update working memory when updating thread metadata', async () => {
        const initialWM = `# Patient Profile
- Name: John Doe`;

        const thread = await memory.createThread({
          resourceId,
          metadata: { workingMemory: initialWM },
        });

        const updatedWM = `# Patient Profile
- Name: John Doe
- Blood Type: O+`;

        await memory.updateThread({
          id: thread.id,
          title: thread.title || 'Test Thread',
          metadata: {
            ...thread.metadata,
            workingMemory: updatedWM,
          },
        });

        const retrievedWM = await memory.getWorkingMemory({ threadId: thread.id });
        expect(retrievedWM).toBe(updatedWM);
      });

      it('should produce same result as updateWorkingMemory for thread scope', async () => {
        const workingMemoryData = `# User Info
- Name: Jane Smith
- Location: NYC`;

        // Method 1: Via metadata
        const thread1 = await memory.createThread({
          resourceId,
          metadata: { workingMemory: workingMemoryData },
        });

        // Method 2: Via updateWorkingMemory
        const thread2 = await memory.createThread({ resourceId });
        await memory.updateWorkingMemory({
          threadId: thread2.id,
          resourceId,
          workingMemory: workingMemoryData,
        });

        const wm1 = await memory.getWorkingMemory({ threadId: thread1.id });
        const wm2 = await memory.getWorkingMemory({ threadId: thread2.id });

        expect(wm1).toBe(wm2);
        expect(wm1).toBe(workingMemoryData);
      });

      it('should work as documented in medical consultation example', async () => {
        // Exact example from docs
        const thread = await memory.createThread({
          threadId: 'thread-123',
          resourceId: 'user-456',
          title: 'Medical Consultation',
          metadata: {
            workingMemory: `# Patient Profile
- Name: John Doe
- Blood Type: O+
- Allergies: Penicillin
- Current Medications: None
- Medical History: Hypertension (controlled)`,
          },
        });

        const wm = await memory.getWorkingMemory({ threadId: thread.id });
        expect(wm).toContain('John Doe');
        expect(wm).toContain('O+');
        expect(wm).toContain('Penicillin');
      });
    });

    // Agent Network tests only work with v5+ models (network() method requires v5+)
    describe.skipIf(!isV5PlusModel(model))('Agent Network with Working Memory', () => {
      let storage: LibSQLStore;
      let vector: LibSQLVector;

      beforeEach(async () => {
        // Create a new unique database file in the temp directory for each test
        const dbPath = join(await mkdtemp(join(tmpdir(), `memory-network-test-${Date.now()}`)), 'test.db');

        storage = new LibSQLStore({
          id: 'agent-network-storage',
          url: `file:${dbPath}`,
        });
        vector = new LibSQLVector({
          id: 'agent-network-vector',
          url: `file:${dbPath}`,
        });
      });

      afterEach(async () => {
        // @ts-expect-error - accessing client for cleanup
        await storage.client.close();
        // @ts-expect-error - accessing client for cleanup
        await vector.turso.close();
      });

      describe('Standard Working Memory Tool - Thread Scope', () => {
        runWorkingMemoryNetworkTests(
          () =>
            new Memory({
              options: {
                workingMemory: {
                  enabled: true,
                  scope: 'thread',
                },
                lastMessages: 10,
              },
              storage,
              vector,
              embedder: fastembed,
            }),
          model,
        );
      });

      describe('Standard Working Memory Tool - Resource Scope', () => {
        runWorkingMemoryNetworkTests(
          () =>
            new Memory({
              options: {
                workingMemory: {
                  enabled: true,
                  scope: 'resource',
                },
                lastMessages: 10,
              },
              storage,
              vector,
              embedder: fastembed,
            }),
          model,
        );
      });
    });
  });
}

/**
 * Shared test suite for agent network with working memory.
 * Can be run with any memory configuration (thread/resource scope, standard/vnext).
 */
function runWorkingMemoryNetworkTests(getMemory: () => Memory, model: MastraModelConfig) {
  let mathAgent: Agent;
  let getWeather: Tool;

  beforeAll(() => {
    // Create a math agent that can do calculations
    mathAgent = new Agent({
      id: 'math-agent',
      name: 'math-agent',
      instructions: 'You are a helpful math assistant.',
      model,
    });

    // Create a weather tool
    getWeather = createTool({
      id: 'get-weather',
      description: 'Get current weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async inputData => {
        return { city: inputData.city, temp: 68, condition: 'partly cloudy' };
      },
    });
  });

  // Helper functions to reduce code duplication
  async function collectChunksAndCheckExecution(result: any) {
    const chunks: any[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    const executionResult = await result.result;
    const errorDetails = executionResult?.status === 'failed' ? getErrorDetails(executionResult.error) : undefined;
    expect(errorDetails).toBeUndefined();
    expect(executionResult?.status).not.toBe('failed');

    return chunks;
  }

  function expectRoutingOrder(chunks: any[], expectedOrder: Array<{ primitiveId: string; primitiveType: string }>) {
    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    expect(routingDecisions.length).toBeGreaterThanOrEqual(expectedOrder.length);

    expectedOrder.forEach((expected, index) => {
      const decision = routingDecisions[index];
      expect(decision.payload?.primitiveId).toBe(expected.primitiveId);
      expect(decision.payload?.primitiveType).toBe(expected.primitiveType);
    });
  }

  function extractFullText(chunks: any[]) {
    const textChunks = chunks.filter(
      c =>
        c.type === 'agent-execution-event-text-delta' ||
        c.type === 'routing-agent-text-delta' ||
        c.type === 'text-delta' ||
        c.type === 'text',
    );
    return textChunks
      .map(c => {
        if (c.type === 'agent-execution-event-text-delta') {
          return c.payload?.payload?.textDelta || c.payload?.payload?.text || '';
        }
        if (c.type === 'routing-agent-text-delta') {
          return c.payload?.text || '';
        }
        return c.textDelta || c.text || '';
      })
      .join('');
  }

  it('should call memory tool directly and end loop when only memory update needed', { retry: 3 }, async () => {
    const memory = getMemory();
    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users and can remember things when they ask you to.',
      model,
      memory,
    });

    const threadId = randomUUID();

    const result = await networkAgent.network('My email is test@example.com', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3,
    });

    const chunks = await collectChunksAndCheckExecution(result);

    // 1. Working memory was updated
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory).toContain('test@example.com');

    // 2. Loop ended after memory update (no tool execution chunks, only routing + done)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).not.toContain('tool-call');

    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    const memoryToolRoutes = routingDecisions.filter(c => c.payload?.primitiveId === 'updateWorkingMemory').length;
    expect(memoryToolRoutes).toBe(1);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should call memory tool first, then query agent', { retry: 3 }, async () => {
    const memory = getMemory();

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with math and remember things.',
      model,
      agents: { mathAgent },
      memory,
    });

    const threadId = '68f55d05-8b0b-447c-9d49-28e35cdd5db6';

    const result = await networkAgent.network(
      'Remember that my favorite number is 42, then calculate what 42 multiplied by 3 is',
      {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5,
      },
    );

    const chunks = await collectChunksAndCheckExecution(result);

    // 1. Working memory was updated with favorite number
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory).toContain('42');

    // 2. Math agent was queried (should see agent-execution chunks)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).toContain('agent-execution-start');
    expect(stepTypes).toContain('agent-execution-end');

    // 3. Final result contains calculation answer (126)
    const fullText = extractFullText(chunks);
    expect(fullText).toContain('126');

    // 4. Verify routing order: memory first, then agent
    expectRoutingOrder(chunks, [
      { primitiveId: 'updateWorkingMemory', primitiveType: 'tool' },
      { primitiveId: 'mathAgent', primitiveType: 'agent' },
    ]);

    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    expect(routingDecisions.length).toBeLessThanOrEqual(3);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should query agent first, then call memory tool', { retry: 3 }, async () => {
    const memory = getMemory();

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with math and remember things.',
      model,
      agents: { mathAgent },
      memory,
    });

    const threadId = '58f55d05-8b0b-447c-9d49-28e35cdd5db6';

    const result = await networkAgent.network('Calculate 15 times 4, then remember the result', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 5,
    });

    const chunks = await collectChunksAndCheckExecution(result);

    // 1. Math agent was queried (should see agent-execution chunks)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).toContain('agent-execution-start');
    expect(stepTypes).toContain('agent-execution-end');

    // 2. Final result contains calculation answer (60)
    const fullText = extractFullText(chunks);
    expect(fullText).toContain('60');

    // 3. Working memory was updated with result
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory).toContain('60');

    // 4. Verify routing order: agent first, then memory
    expectRoutingOrder(chunks, [
      { primitiveId: 'mathAgent', primitiveType: 'agent' },
      { primitiveId: 'updateWorkingMemory', primitiveType: 'tool' },
    ]);

    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    expect(routingDecisions.length).toBeLessThanOrEqual(3);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should call memory tool first, then execute user-defined tool', { retry: 3 }, async () => {
    const memory = getMemory();
    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with weather and remember their preferences.',
      model,
      tools: { getWeather },
      memory,
    });

    const threadId = '78f55d05-8b0b-447c-9d49-28e35cdd5db6';

    const result = await networkAgent.network(
      'Remember that I live in San Francisco, then get me the weather for my city',
      {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5, // Allow multiple steps for memory + tool
      },
    );

    const chunks = await collectChunksAndCheckExecution(result);

    // 1. Working memory was updated with location
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory?.toLowerCase()).toContain('san francisco');

    // 2. Weather tool was executed (should see tool-execution chunks)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).toContain('tool-execution-start');
    expect(stepTypes).toContain('tool-execution-end');

    // 3. Final result contains weather information
    const fullText = extractFullText(chunks);
    expect(fullText.toLowerCase()).toMatch(/weather|sunny|72/);

    // 4. Verify routing order: memory first, then tool
    expectRoutingOrder(chunks, [
      { primitiveId: 'updateWorkingMemory', primitiveType: 'tool' },
      { primitiveId: 'getWeather', primitiveType: 'tool' },
    ]);

    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    expect(routingDecisions.length).toBeLessThanOrEqual(3);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should execute user-defined tool first, then call memory tool', { retry: 3 }, async () => {
    const memory = getMemory();
    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with weather and remember their preferences.',
      model,
      tools: { getWeather },
      memory,
    });

    const threadId = '88f55d05-8b0b-447c-9d49-28e35cdd5db6';

    const result = await networkAgent.network('Get the weather for Boston, then remember that is where I live', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 5,
    });

    const chunks = await collectChunksAndCheckExecution(result);

    // 1. Weather tool was executed (should see tool-execution chunks)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).toContain('tool-execution-start');
    expect(stepTypes).toContain('tool-execution-end');

    // 2. Final result contains weather information
    const fullText = extractFullText(chunks);
    expect(fullText.toLowerCase()).toMatch(/weather|cloudy|68/);

    // 3. Working memory was updated with location
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory?.toLowerCase()).toContain('boston');

    // 4. Verify routing order: tool first, then memory
    expectRoutingOrder(chunks, [
      { primitiveId: 'getWeather', primitiveType: 'tool' },
      { primitiveId: 'updateWorkingMemory', primitiveType: 'tool' },
    ]);

    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    expect(routingDecisions.length).toBeLessThanOrEqual(3);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should handle multiple memory updates in single network call', { retry: 3 }, async () => {
    const memory = getMemory();

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users and remember things they tell you.',
      model,
      memory,
    });

    const threadId = '98f55d05-8b0b-447c-9d49-28e35cdd5db6';

    // Single request with multiple pieces of information to remember
    const result = await networkAgent.network('My name is Alice and I work as a software engineer', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 5,
    });

    const chunks = await collectChunksAndCheckExecution(result);

    // Verify both pieces of information are in working memory
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toContain('Alice');
    expect(workingMemory?.toLowerCase()).toContain('software engineer');

    // Should handle in one or two memory tool calls (either combined or separate)
    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    const memoryToolRoutes = routingDecisions.filter(c => c.payload?.primitiveId === 'updateWorkingMemory').length;
    expect(memoryToolRoutes).toBe(1);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should handle complex multi-step workflow with memory, agents, and tools', { retry: 3 }, async () => {
    const memory = getMemory();

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with various tasks efficiently. Complete all parts of multi-step requests.',
      agents: { mathAgent },
      tools: { getWeather },
      model,
      memory,
    });

    const threadId = 'a8f55d05-8b0b-447c-9d49-28e35cdd5db6';

    // Complex multi-step task with memory in the middle
    const result = await networkAgent.network(
      'Calculate what 15 times 4 is, then remember that my name is Bob and I live in Seattle, then tell me the weather in Seattle.',
      {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5,
      },
    );

    const chunks = await collectChunksAndCheckExecution(result);

    // 1. Memory should be saved
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory).toContain('Bob');
    expect(workingMemory?.toLowerCase()).toContain('seattle');

    // 2. Should have completed calculation (60)
    const fullText = extractFullText(chunks);
    expect(fullText).toContain('60');

    // 3. Should have called weather tool
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).toContain('tool-execution-start');
    expect(stepTypes).toContain('tool-execution-end');

    // Verify weather info is in response
    expect(fullText.toLowerCase()).toMatch(/weather|cloudy|68/);

    // 4. Should have called multiple primitive types (memory, agent, tool)
    const routingDecisions = chunks.filter(c => c.type === 'routing-agent-end');
    const primitiveTypes = routingDecisions.map(d => d.payload?.primitiveType);

    expect(primitiveTypes).toContain('tool'); // Both memory and weather are tools
    expect(primitiveTypes).toContain('agent'); // Math agent

    expect(routingDecisions.length).toBeLessThan(8);

    const memoryToolRoutes = routingDecisions.filter(c => c.payload?.primitiveId === 'updateWorkingMemory').length;
    expect(memoryToolRoutes).toBe(1);

    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });
}
