import type { MastraDBMessage } from '@mastra/core/agent';
import type {
  InputProcessor,
  OutputProcessor,
  Processor,
  ProcessInputArgs,
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
} from '@mastra/core/processors';
import type { MemoryStorage } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { generateText, streamText } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createProcessorMiddleware, withMastra } from './middleware';

// Helper to create a mock model with a specific response
function createMockModel(response: string = 'Test response') {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      content: [{ type: 'text', text: response }],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'Test ' },
        { type: 'text-delta', id: '1', delta: 'response' },
        { type: 'text-end', id: '1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        },
      ]),
      rawCall: { rawPrompt: [], rawSettings: {} },
      warnings: [],
    }),
  });
}

describe('withMastra middleware', () => {
  describe('generateText with processors', () => {
    it('should run input processors before LLM call', async () => {
      const processedInputs: string[] = [];

      const loggingProcessor: InputProcessor = {
        id: 'logger',
        name: 'Logging Processor',
        async processInput(args: ProcessInputArgs) {
          for (const msg of args.messages) {
            const text =
              typeof msg.content === 'string'
                ? msg.content
                : msg.content?.parts
                    ?.filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('') || '';
            processedInputs.push(text);
          }
          return args.messages;
        },
      };

      const model = withMastra(createMockModel(), {
        inputProcessors: [loggingProcessor],
      });

      const result = await generateText({
        model,
        prompt: 'Hello world',
      });

      expect(processedInputs).toContain('Hello world');
      expect(result.text).toBe('Test response');
    });

    it('should run output processors after LLM call', async () => {
      const processedOutputs: string[] = [];

      const outputProcessor: OutputProcessor = {
        id: 'output-logger',
        name: 'Output Logger',
        async processOutputResult(args: ProcessOutputResultArgs) {
          for (const msg of args.messages) {
            if (msg.role === 'assistant') {
              const text =
                msg.content?.parts
                  ?.filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('') || '';
              processedOutputs.push(text);
            }
          }
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('AI response here'), {
        outputProcessors: [outputProcessor],
      });

      const result = await generateText({
        model,
        prompt: 'Hello',
      });

      expect(processedOutputs).toContain('AI response here');
      expect(result.text).toBe('AI response here');
    });

    it('should run input and output processors in order', async () => {
      const executionOrder: string[] = [];

      const inputProcessor1: InputProcessor = {
        id: 'input-1',
        async processInput(args) {
          executionOrder.push('input-1');
          return args.messages;
        },
      };

      const inputProcessor2: InputProcessor = {
        id: 'input-2',
        async processInput(args) {
          executionOrder.push('input-2');
          return args.messages;
        },
      };

      const outputProcessor1: OutputProcessor = {
        id: 'output-1',
        async processOutputResult(args) {
          executionOrder.push('output-1');
          return args.messageList;
        },
      };

      const outputProcessor2: OutputProcessor = {
        id: 'output-2',
        async processOutputResult(args) {
          executionOrder.push('output-2');
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel(), {
        inputProcessors: [inputProcessor1, inputProcessor2],
        outputProcessors: [outputProcessor1, outputProcessor2],
      });

      await generateText({
        model,
        prompt: 'Test',
      });

      expect(executionOrder).toEqual(['input-1', 'input-2', 'output-1', 'output-2']);
    });

    it('should allow output processor to modify response text', async () => {
      const prefixProcessor: OutputProcessor = {
        id: 'prefix',
        name: 'Prefix Processor',
        async processOutputResult(args: ProcessOutputResultArgs) {
          const prefix = '🤖 ';

          // Modify messages in the messageList
          const responseMessages = args.messageList.get.response.db();
          for (const msg of responseMessages) {
            if (msg.role === 'assistant' && msg.content?.parts) {
              for (const part of msg.content.parts) {
                if (part.type === 'text') {
                  (part as any).text = prefix + (part as any).text;
                }
              }
            }
          }

          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('Hello'), {
        outputProcessors: [prefixProcessor],
      });

      const result = await generateText({
        model,
        prompt: 'Test',
      });

      expect(result.text).toBe('🤖 Hello');
    });
  });

  describe('streamText with processors', () => {
    it('should run input processors before streaming', async () => {
      const processedInputs: string[] = [];

      const loggingProcessor: InputProcessor = {
        id: 'logger',
        async processInput(args: ProcessInputArgs) {
          for (const msg of args.messages) {
            const text =
              typeof msg.content === 'string'
                ? msg.content
                : msg.content?.parts
                    ?.filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('') || '';
            processedInputs.push(text);
          }
          return args.messages;
        },
      };

      const model = withMastra(createMockModel(), {
        inputProcessors: [loggingProcessor],
      });

      const { textStream } = await streamText({
        model,
        prompt: 'Hello stream',
      });

      // Consume the stream
      let fullText = '';
      for await (const chunk of textStream) {
        fullText += chunk;
      }

      expect(processedInputs).toContain('Hello stream');
      expect(fullText).toBe('Test response');
    });

    it('should run processOutputStream for each chunk', async () => {
      const chunks: string[] = [];

      const streamProcessor: OutputProcessor = {
        id: 'stream-logger',
        async processOutputStream(args: ProcessOutputStreamArgs) {
          if (args.part.type === 'text-delta') {
            chunks.push(args.part.payload.text);
          }
          return args.part;
        },
      };

      const model = withMastra(createMockModel(), {
        outputProcessors: [streamProcessor],
      });

      const { textStream } = await streamText({
        model,
        prompt: 'Test',
      });

      // Consume the stream
      for await (const _ of textStream) {
        // Just consume
      }

      expect(chunks).toContain('Test ');
      expect(chunks).toContain('response');
    });

    it('should allow processOutputStream to filter chunks', async () => {
      const filterProcessor: OutputProcessor = {
        id: 'filter',
        async processOutputStream(args: ProcessOutputStreamArgs) {
          if (args.part.type === 'text-delta') {
            // Filter out chunks containing "Test"
            if (args.part.payload.text.includes('Test')) {
              return null; // Filter out this chunk
            }
          }
          return args.part;
        },
      };

      const model = withMastra(createMockModel(), {
        outputProcessors: [filterProcessor],
      });

      const { textStream } = await streamText({
        model,
        prompt: 'Hello',
      });

      let fullText = '';
      for await (const chunk of textStream) {
        fullText += chunk;
      }

      // "Test " should be filtered, only "response" remains
      expect(fullText).toBe('response');
    });

    it('should maintain state across stream chunks', async () => {
      let finalChunkCount = 0;

      const stateProcessor: OutputProcessor = {
        id: 'state',
        async processOutputStream(args: ProcessOutputStreamArgs) {
          const { part, state } = args;

          if (state.chunkCount === undefined) {
            state.chunkCount = 0;
          }

          if (part.type === 'text-delta') {
            (state.chunkCount as number)++;
            finalChunkCount = state.chunkCount as number;
          }

          return part;
        },
      };

      const model = withMastra(createMockModel(), {
        outputProcessors: [stateProcessor],
      });

      const { textStream } = await streamText({
        model,
        prompt: 'Test',
      });

      for await (const _ of textStream) {
        // Consume
      }

      // Should have counted 2 text-delta chunks ("Test " and "response")
      expect(finalChunkCount).toBe(2);
    });
  });

  describe('tripwire/abort functionality', () => {
    it('should abort on input processor tripwire', async () => {
      const guardProcessor: InputProcessor = {
        id: 'guard',
        async processInput(args: ProcessInputArgs) {
          for (const msg of args.messages) {
            const text =
              typeof msg.content === 'string'
                ? msg.content
                : msg.content?.parts
                    ?.filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('') || '';

            if (text.toLowerCase().includes('blocked')) {
              args.abort('Content blocked');
            }
          }
          return args.messages;
        },
      };

      const model = withMastra(createMockModel(), {
        inputProcessors: [guardProcessor],
      });

      const result = await generateText({
        model,
        prompt: 'This should be blocked',
      });

      // When tripwire is triggered, the response should contain the abort message
      expect(result.text).toBe('Content blocked');
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.message?.includes('Tripwire'))).toBe(true);
    });

    it('should not call LLM when input tripwire is triggered', async () => {
      let llmCalled = false;

      const mockModel = new MockLanguageModelV2({
        doGenerate: async () => {
          llmCalled = true;
          return {
            content: [{ type: 'text', text: 'Should not see this' }],
            finishReason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            rawCall: { rawPrompt: [], rawSettings: {} },
            warnings: [],
          };
        },
      });

      const guardProcessor: InputProcessor = {
        id: 'guard',
        async processInput(args: ProcessInputArgs) {
          args.abort('Blocked');
          return args.messages;
        },
      };

      const model = withMastra(mockModel, {
        inputProcessors: [guardProcessor],
      });

      await generateText({
        model,
        prompt: 'Test',
      });

      expect(llmCalled).toBe(false);
    });

    it('should abort on output processor tripwire', async () => {
      const outputGuard: OutputProcessor = {
        id: 'output-guard',
        async processOutputResult(args: ProcessOutputResultArgs) {
          for (const msg of args.messages) {
            if (msg.role === 'assistant') {
              const text =
                msg.content?.parts
                  ?.filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('') || '';
              if (text.includes('forbidden')) {
                args.abort('Output contains forbidden content');
              }
            }
          }
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('This is forbidden content'), {
        outputProcessors: [outputGuard],
      });

      const result = await generateText({
        model,
        prompt: 'Test',
      });

      expect(result.text).toBe('Output contains forbidden content');
    });
  });

  describe('memory integration with LibSQL (real storage)', () => {
    let storage: LibSQLStore;
    let memoryStore: MemoryStorage;
    let threadId: string;
    const resourceId = 'test-user';

    beforeEach(async () => {
      // Create in-memory LibSQL storage for each test
      storage = new LibSQLStore({
        id: 'middleware-test',
        url: 'file::memory:',
      });
      await storage.init();

      // Get the memory domain store for the middleware
      memoryStore = (await storage.getStore('memory'))!;

      // Create a unique thread ID for each test
      threadId = `thread-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Create the thread
      await memoryStore.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Test Thread',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    afterEach(async () => {
      // Clean up is automatic with in-memory database
    });

    it('should retrieve historical messages from storage', async () => {
      // Seed historical messages using real storage
      await memoryStore.saveMessages({
        messages: [
          {
            id: 'hist-msg-1',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'What is TypeScript?' }] },
            createdAt: new Date(Date.now() - 2000),
          },
          {
            id: 'hist-msg-2',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'TypeScript is a typed superset of JavaScript.' }],
            },
            createdAt: new Date(Date.now() - 1000),
          },
        ],
      });

      // Verify messages were saved
      const { messages: storedMessages } = await memoryStore.listMessages({ threadId });
      expect(storedMessages).toHaveLength(2);

      // Track messages seen during output processing
      let receivedMessages: MastraDBMessage[] = [];

      const inspectorProcessor: OutputProcessor = {
        id: 'inspector',
        async processOutputResult(args: ProcessOutputResultArgs) {
          receivedMessages = [...args.messageList.get.all.db()];
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('Here is the follow-up answer.'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
        outputProcessors: [inspectorProcessor],
      });

      await generateText({
        model,
        prompt: 'Tell me more about TypeScript.',
      });

      // Should have: 2 historical + 1 new input + 1 response = 4 messages
      expect(receivedMessages.length).toBeGreaterThanOrEqual(3);

      const texts = receivedMessages.map(
        m =>
          m.content?.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('') || '',
      );

      expect(texts).toContain('What is TypeScript?');
      expect(texts).toContain('TypeScript is a typed superset of JavaScript.');
    });

    it('should save new messages to storage after response', async () => {
      const model = withMastra(createMockModel('The answer is 42.'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
      });

      await generateText({
        model,
        prompt: 'What is the meaning of life?',
      });

      // Check that messages were persisted to storage
      const { messages: storedMessages } = await memoryStore.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });

      expect(storedMessages.length).toBeGreaterThanOrEqual(2);

      const roles = storedMessages.map(m => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');

      const texts = storedMessages.map(
        m =>
          m.content?.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('') || '',
      );

      expect(texts).toContain('What is the meaning of life?');
      expect(texts).toContain('The answer is 42.');
    });

    it('should respect lastMessages limit', async () => {
      // Seed 10 historical messages
      const historicalMessages: MastraDBMessage[] = [];
      for (let i = 0; i < 10; i++) {
        historicalMessages.push({
          id: `hist-msg-${i}`,
          threadId,
          resourceId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: `Historical message ${i}` }] },
          createdAt: new Date(Date.now() - (10 - i) * 1000),
        });
      }

      await memoryStore.saveMessages({ messages: historicalMessages });

      // Verify all 10 messages were saved
      const { messages: allMessages } = await memoryStore.listMessages({ threadId });
      expect(allMessages).toHaveLength(10);

      let receivedMessageCount = 0;

      // Use output processor to count messages after MessageHistory has run
      const countProcessor: OutputProcessor = {
        id: 'counter',
        async processOutputResult(args: ProcessOutputResultArgs) {
          receivedMessageCount = args.messageList.get.all.db().length;
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('Response'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 3, // Only get last 3 messages
        },
        outputProcessors: [countProcessor],
      });

      await generateText({
        model,
        prompt: 'New message',
      });

      // Should have: 3 historical + 1 input + 1 response = 5 messages (approximately)
      // The exact count may vary due to message source tracking in the middleware
      expect(receivedMessageCount).toBeLessThanOrEqual(6);
      expect(receivedMessageCount).toBeGreaterThanOrEqual(3);
    });

    it('should not duplicate messages when continuing conversation', async () => {
      // First turn
      const model1 = withMastra(createMockModel('First response'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
      });

      await generateText({
        model: model1,
        prompt: 'First question',
      });

      // Second turn - should include first turn's messages without duplication
      let messageIds: (string | undefined)[] = [];

      const inspectorProcessor: OutputProcessor = {
        id: 'inspector',
        async processOutputResult(args: ProcessOutputResultArgs) {
          messageIds = args.messageList.get.all.db().map(m => m.id);
          return args.messageList;
        },
      };

      const model2 = withMastra(createMockModel('Second response'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
        outputProcessors: [inspectorProcessor],
      });

      await generateText({
        model: model2,
        prompt: 'Second question',
      });

      // Check for duplicates
      const definedIds = messageIds.filter(Boolean);
      const uniqueIds = new Set(definedIds);
      expect(uniqueIds.size).toBe(definedIds.length);
    });

    it('should not re-persist historical messages on subsequent turns', async () => {
      const model1 = withMastra(createMockModel('First response'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
      });

      await generateText({
        model: model1,
        prompt: 'First question',
      });

      const { messages: afterTurn1 } = await memoryStore.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });
      expect(afterTurn1).toHaveLength(2);
      const turn1Roles = afterTurn1.map(m => m.role);
      expect(turn1Roles).toContain('user');
      expect(turn1Roles).toContain('assistant');

      const model2 = withMastra(createMockModel('Second response'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
      });

      await generateText({
        model: model2,
        prompt: 'Second question',
      });

      const { messages: afterTurn2 } = await memoryStore.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });
      expect(afterTurn2).toHaveLength(4);

      const texts = afterTurn2.map(
        m =>
          m.content?.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('') || '',
      );
      expect(texts.sort()).toEqual(['First question', 'First response', 'Second question', 'Second response'].sort());

      const model3 = withMastra(createMockModel('Third response'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
      });

      await generateText({
        model: model3,
        prompt: 'Third question',
      });

      const { messages: afterTurn3 } = await memoryStore.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
      });
      expect(afterTurn3).toHaveLength(6);
    });

    it('should handle multi-turn conversation with persistent storage', async () => {
      // Turn 1
      const model1 = withMastra(createMockModel('My name is Assistant.'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
      });

      await generateText({
        model: model1,
        prompt: 'What is your name?',
      });

      // Turn 2 - should remember the previous exchange
      let turn2Messages: MastraDBMessage[] = [];

      const inspectorProcessor: OutputProcessor = {
        id: 'inspector',
        async processOutputResult(args: ProcessOutputResultArgs) {
          turn2Messages = [...args.messageList.get.all.db()];
          return args.messageList;
        },
      };

      const model2 = withMastra(createMockModel('You asked me my name, and I told you.'), {
        memory: {
          storage: memoryStore,
          threadId,
          resourceId,
          lastMessages: 10,
        },
        outputProcessors: [inspectorProcessor],
      });

      await generateText({
        model: model2,
        prompt: 'What did I ask you?',
      });

      // Should have all previous messages
      expect(turn2Messages.length).toBeGreaterThanOrEqual(3);

      const texts = turn2Messages.map(
        m =>
          m.content?.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('') || '',
      );

      expect(texts).toContain('What is your name?');
      expect(texts).toContain('My name is Assistant.');
    });
  });

  describe('createProcessorMiddleware (low-level API)', () => {
    it('should create middleware with processors', async () => {
      const processor: Processor<'test'> = {
        id: 'test',
        async processInput(args) {
          return args.messages;
        },
        async processOutputResult(args) {
          return args.messageList;
        },
      };

      const middleware = createProcessorMiddleware({
        inputProcessors: [processor as InputProcessor],
        outputProcessors: [processor as OutputProcessor],
      });

      expect(middleware.middlewareVersion).toBe('v2');
      expect(middleware.transformParams).toBeDefined();
      expect(middleware.wrapGenerate).toBeDefined();
      expect(middleware.wrapStream).toBeDefined();
    });

    it('should pass memory context to processors via RequestContext', async () => {
      let receivedThreadId: string | undefined;
      let receivedResourceId: string | undefined;

      const contextProcessor: InputProcessor = {
        id: 'context',
        async processInput(args) {
          const memoryContext = args.requestContext?.get('MastraMemory');
          receivedThreadId = memoryContext?.thread?.id;
          receivedResourceId = memoryContext?.resourceId;
          return args.messages;
        },
      };

      const middleware = createProcessorMiddleware({
        inputProcessors: [contextProcessor],
        memory: {
          threadId: 'test-thread',
          resourceId: 'test-resource',
        },
      });

      const mockModel = createMockModel();

      // Call transformParams to trigger processInput
      await middleware.transformParams!({
        type: 'generate',
        model: mockModel,
        params: {
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        } as any,
      });

      expect(receivedThreadId).toBe('test-thread');
      expect(receivedResourceId).toBe('test-resource');
    });
  });

  describe('edge cases', () => {
    it('should handle empty processor arrays', async () => {
      const model = withMastra(createMockModel('Hello'), {
        inputProcessors: [],
        outputProcessors: [],
      });

      const result = await generateText({
        model,
        prompt: 'Test',
      });

      expect(result.text).toBe('Hello');
    });

    it('should handle model with no options', async () => {
      const model = withMastra(createMockModel('Response'));

      const result = await generateText({
        model,
        prompt: 'Test',
      });

      expect(result.text).toBe('Response');
    });

    it('should handle processor that returns messageList', async () => {
      const processor: InputProcessor = {
        id: 'list-returner',
        async processInput(args) {
          // Return the messageList instance (common pattern)
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('OK'), {
        inputProcessors: [processor],
      });

      const result = await generateText({
        model,
        prompt: 'Test',
      });

      expect(result.text).toBe('OK');
    });

    it('should handle processor that returns array of messages', async () => {
      const processor: InputProcessor = {
        id: 'array-returner',
        async processInput(args) {
          // Return the messages array (alternative pattern)
          return args.messages;
        },
      };

      const model = withMastra(createMockModel('OK'), {
        inputProcessors: [processor],
      });

      const result = await generateText({
        model,
        prompt: 'Test',
      });

      expect(result.text).toBe('OK');
    });

    it('should handle system messages in prompt', async () => {
      let systemMessagesSeen = false;

      const processor: InputProcessor = {
        id: 'system-checker',
        async processInput(args) {
          const allMessages = args.messageList.get.all.db();
          systemMessagesSeen =
            allMessages.some(m => m.role === 'system') || args.messageList.getAllSystemMessages().length > 0;
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('OK'), {
        inputProcessors: [processor],
      });

      await generateText({
        model,
        system: 'You are a helpful assistant',
        prompt: 'Hello',
      });

      expect(systemMessagesSeen).toBe(true);
    });

    it('should handle multi-turn conversation', async () => {
      let messageCount = 0;

      const processor: InputProcessor = {
        id: 'counter',
        async processInput(args) {
          messageCount = args.messages.length;
          return args.messageList;
        },
      };

      const model = withMastra(createMockModel('Response'), {
        inputProcessors: [processor],
      });

      await generateText({
        model,
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ],
      });

      expect(messageCount).toBe(3);
    });
  });
});
