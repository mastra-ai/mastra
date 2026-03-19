import { randomUUID } from 'node:crypto';
import type { UUID } from 'node:crypto';
import { getLLMTestMode } from '@internal/llm-recorder';
import { isV5PlusModel, setupDummyApiKeys, agentGenerate, agentStream } from '@internal/test-utils';
import { toAISdkStream } from '@mastra/ai-sdk';
import { Agent } from '@mastra/core/agent';
import { AIV5Adapter } from '@mastra/core/agent/message-list';
import type { MastraModelConfig } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import { describe, expect, it } from 'vitest';

setupDummyApiKeys(getLLMTestMode(), ['openai']);

export async function setupStreamingMemoryTest({
  model,
  memory,
  tools,
}: {
  memory: MastraMemory;
  model: MastraModelConfig;
  tools: any;
}) {
  describe('Memory Streaming Tests', () => {
    it('should handle multiple tool calls in memory thread history', async () => {
      // Create agent with memory and tools
      const agent = new Agent({
        id: 'test-agent',
        name: 'test',
        instructions:
          'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. Respond in a pirate accent and dont use the degrees symbol, print the word degrees when needed.',
        model,
        memory,
        tools,
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();
      const isV5Plus = isV5PlusModel(model);

      // First weather check
      const stream1 = (await agentStream(agent, 'what is the weather in LA?', { threadId, resourceId }, model)) as any;

      if (isV5Plus) {
        // Collect first stream
        const chunks1: string[] = [];
        for await (const chunk of stream1.fullStream) {
          if (chunk.type === `text-delta`) {
            // Handle both v5+ (payload.text) and legacy (textDelta) formats
            const text = 'payload' in chunk ? chunk.payload.text : chunk.textDelta;
            if (text) chunks1.push(text);
          }
        }
        const response1 = chunks1.join('');

        expect(chunks1.length).toBeGreaterThan(0);
        expect(response1).toContain('70 degrees');
      } else {
        // Collect first stream
        const chunks1: string[] = [];
        for await (const chunk of stream1.textStream) {
          chunks1.push(chunk);
        }
        const response1 = chunks1.join('');

        expect(chunks1.length).toBeGreaterThan(0);
        expect(response1).toContain('70 degrees');
      }

      // Second weather check
      const stream2Raw = (await agentStream(
        agent,
        'what is the weather in Seattle?',
        { threadId, resourceId },
        model,
      )) as any;

      if (isV5Plus) {
        const stream2 = toAISdkStream(stream2Raw as any, { from: 'agent' });

        // Collect second stream
        const chunks2: string[] = [];

        for await (const chunk of stream2) {
          if (chunk.type === `text-delta`) {
            chunks2.push(chunk.delta);
          }
        }
        const response2 = chunks2.join('');

        expect(chunks2.length).toBeGreaterThan(0);
        expect(response2).toContain('Seattle');
        expect(response2).toContain('70 degrees');
      } else {
        // Collect second stream
        const chunks2: string[] = [];
        for await (const chunk of stream2Raw.textStream) {
          chunks2.push(chunk);
        }
        const response2 = chunks2.join('');

        expect(chunks2.length).toBeGreaterThan(0);
        expect(response2).toContain('Seattle');
        expect(response2).toContain('70 degrees');
      }
    });

    it('should use custom mastra ID generator for messages in memory', async () => {
      const agent = new Agent({
        id: 'test-msg-id-agent',
        name: 'test-msg-id',
        instructions: 'you are a helpful assistant.',
        model,
        memory,
      });

      const threadId = randomUUID();
      const resourceId = 'test-resource-msg-id';
      const customIds: UUID[] = [];

      new Mastra({
        idGenerator: () => {
          const id = randomUUID();
          customIds.push(id);
          return id;
        },
        agents: {
          agent: agent,
        },
      });

      await agentGenerate(agent, 'Hello, world!', { threadId, resourceId }, model);

      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      expect(messages).toHaveLength(2);
      // Custom ID generator should be called at least once per message
      expect(customIds.length).toBeGreaterThanOrEqual(messages.length);
      for (const message of messages) {
        if (!(`id` in message)) {
          throw new Error(`Expected message.id`);
        }
        expect(customIds).toContain(message.id);
      }
    });

    describe('data-* parts persistence (issue #10477 and #10936)', () => {
      it('should preserve data-* parts through save → recall → UI conversion round-trip', async () => {
        const threadId = randomUUID();
        const resourceId = 'test-data-parts-resource';

        // Create a thread first
        await memory.createThread({
          threadId,
          resourceId,
          title: 'Data Parts Test Thread',
        });

        // Save messages with data-* custom parts (simulating what writer.custom() would produce)
        const messagesWithDataParts = [
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'user' as const,
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Upload my file please' }],
            },
            createdAt: new Date(),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: 'Processing your file...' },
                {
                  type: 'data-upload-progress' as const,
                  data: {
                    fileName: 'document.pdf',
                    progress: 50,
                    status: 'uploading',
                  },
                },
              ],
            },
            createdAt: new Date(Date.now() + 1000),
          },
          {
            id: randomUUID(),
            threadId,
            resourceId,
            role: 'assistant' as const,
            content: {
              format: 2 as const,
              parts: [
                { type: 'text' as const, text: 'File uploaded successfully!' },
                {
                  type: 'data-file-reference' as const,
                  data: {
                    fileId: 'file-123',
                    fileName: 'document.pdf',
                    fileSize: 1024,
                  },
                },
              ],
            },
            createdAt: new Date(Date.now() + 2000),
          },
        ];

        // Save messages to storage
        await memory.saveMessages({ messages: messagesWithDataParts });

        // Recall messages from storage
        const recallResult = await memory.recall({
          threadId,
          resourceId,
        });

        expect(recallResult.messages.length).toBe(3);

        // Verify data-* parts are present in recalled messages (DB format)
        const assistantMessages = recallResult.messages.filter(m => m.role === 'assistant');
        expect(assistantMessages.length).toBe(2);

        // Check first assistant message has data-upload-progress
        const uploadProgressMsg = assistantMessages.find(m =>
          m.content.parts.some(p => p.type === 'data-upload-progress'),
        );
        expect(uploadProgressMsg).toBeDefined();
        const uploadProgressPart = uploadProgressMsg!.content.parts.find(p => p.type === 'data-upload-progress');
        expect(uploadProgressPart).toBeDefined();
        expect((uploadProgressPart as any).data.progress).toBe(50);

        // Check second assistant message has data-file-reference
        const fileRefMsg = assistantMessages.find(m => m.content.parts.some(p => p.type === 'data-file-reference'));
        expect(fileRefMsg).toBeDefined();
        const fileRefPart = fileRefMsg!.content.parts.find(p => p.type === 'data-file-reference');
        expect(fileRefPart).toBeDefined();
        expect((fileRefPart as any).data.fileId).toBe('file-123');

        // Now convert to AIV5 UI format (this is what the frontend would receive)
        const uiMessages = recallResult.messages.map(m => AIV5Adapter.toUIMessage(m));

        expect(uiMessages.length).toBe(3);

        // Verify data-* parts are preserved in UI format
        const uiAssistantMessages = uiMessages.filter(m => m.role === 'assistant');
        expect(uiAssistantMessages.length).toBe(2);

        // Check data-upload-progress is preserved in UI format
        const uiUploadProgressMsg = uiAssistantMessages.find(m => m.parts.some(p => p.type === 'data-upload-progress'));
        expect(uiUploadProgressMsg).toBeDefined();
        const uiUploadProgressPart = uiUploadProgressMsg!.parts.find(p => p.type === 'data-upload-progress');
        expect(uiUploadProgressPart).toBeDefined();
        expect((uiUploadProgressPart as any).data.progress).toBe(50);
        expect((uiUploadProgressPart as any).data.fileName).toBe('document.pdf');

        // Check data-file-reference is preserved in UI format
        const uiFileRefMsg = uiAssistantMessages.find(m => m.parts.some(p => p.type === 'data-file-reference'));
        expect(uiFileRefMsg).toBeDefined();
        const uiFileRefPart = uiFileRefMsg!.parts.find(p => p.type === 'data-file-reference');
        expect(uiFileRefPart).toBeDefined();
        expect((uiFileRefPart as any).data.fileId).toBe('file-123');
        expect((uiFileRefPart as any).data.fileName).toBe('document.pdf');

        // Clean up
        await memory.deleteThread(threadId);
      });
    });
  });
}
