import { createServer } from 'node:net';
import { randomUUID, type UUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { toAISdkStream } from '@mastra/ai-sdk';
import type { MastraModelConfig } from '@mastra/core/llm';
import { Agent } from '@mastra/core/agent';
import { MastraMemory } from '@mastra/core/memory';
import { Mastra } from '@mastra/core/mastra';

function isV5PlusModel(model: MastraModelConfig): boolean {
  if (typeof model === 'string') return true;
  if (typeof model === 'object' && 'specificationVersion' in model) {
    return model.specificationVersion === 'v2' || model.specificationVersion === 'v3';
  }
  return false;
}

// Helper to find an available port
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// Set up JSDOM environment for React testing
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

// @ts-ignore - JSDOM types don't match exactly but this works for testing
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  writable: false,
});
global.fetch = global.fetch || fetch;

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
      const stream1 = isV5Plus
        ? await agent.stream('what is the weather in LA?', { threadId, resourceId })
        : await agent.streamLegacy('what is the weather in LA?', { threadId, resourceId });

      if (isV5Plus) {
        // Collect first stream
        const chunks1: string[] = [];
        for await (const chunk of stream1.fullStream) {
          if (chunk.type === `text-delta`) {
            // Handle both v5+ (payload.text) and legacy (textDelta) formats
            const text = (chunk as any).payload?.text ?? (chunk as any).textDelta;
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
      const stream2Raw = isV5Plus
        ? await agent.stream('what is the weather in Seattle?', { threadId, resourceId })
        : await agent.streamLegacy('what is the weather in Seattle?', { threadId, resourceId });

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

      const isV5Plus = isV5PlusModel(model);
      if (isV5Plus) {
        await agent.generate('Hello, world!', {
          threadId,
          resourceId,
        });
      } else {
        await agent.generateLegacy('Hello, world!', {
          threadId,
          resourceId,
        });
      }

      const agentMemory = (await agent.getMemory())!;
      const { messages } = await agentMemory.recall({ threadId });

      console.log('Custom IDs: ', customIds);
      console.log('Messages: ', messages);

      expect(messages).toHaveLength(2);
      expect(messages.length).toBeLessThan(customIds.length);
      for (const message of messages) {
        if (!(`id` in message)) {
          throw new Error(`Expected message.id`);
        }
        expect(customIds).contains(message.id);
      }
    });
  });
}
