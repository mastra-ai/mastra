import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { UUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { openai } from '@ai-sdk/openai';
import { useChat } from '@ai-sdk/react';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport, isToolUIPart } from 'ai';
import { JSDOM } from 'jsdom';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { memory, weatherAgent } from './mastra/agents/weather';
import { weatherTool } from './mastra/tools/weather';

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
global.navigator = dom.window.navigator;
global.fetch = global.fetch || fetch;

describe('Memory Streaming Tests', () => {
  it('should handle multiple tool calls in memory thread history', async () => {
    // Create agent with memory and tools
    const agent = new Agent({
      name: 'test',
      instructions:
        'You are a weather agent. When asked about weather in any city, use the get_weather tool with the city name as the postal code. Respond in a pirate accent and dont use the degrees symbol, print the word degrees when needed.',
      model: openai('gpt-4o'),
      memory,
      tools: { get_weather: weatherTool },
    });

    const threadId = randomUUID();
    const resourceId = 'test-resource';

    // First weather check
    const stream1 = await agent.streamVNext('what is the weather in LA?', {
      threadId,
      resourceId,
    });

    // Collect first stream
    const chunks1: string[] = [];
    for await (const chunk of stream1.fullStream) {
      if (chunk.type === `text-delta`) {
        chunks1.push(chunk.payload.text);
      }
    }
    const response1 = chunks1.join('');

    expect(chunks1.length).toBeGreaterThan(0);
    expect(response1).toContain('70 degrees');

    // Second weather check
    const stream2 = await agent.streamVNext('what is the weather in Seattle?', {
      threadId,
      resourceId,
      format: 'aisdk', // use aisdk output type this time just for fun
    });

    // Collect second stream
    const chunks2: string[] = [];
    for await (const chunk of stream2.fullStream) {
      if (chunk.type === `text-delta`) {
        chunks2.push(chunk.text);
      }
    }
    const response2 = chunks2.join('');

    expect(chunks2.length).toBeGreaterThan(0);
    expect(response2).toContain('Seattle');
    expect(response2).toContain('70 degrees');
  });

  it('should use custom mastra ID generator for messages in memory', async () => {
    const agent = new Agent({
      name: 'test-msg-id',
      instructions: 'you are a helpful assistant.',
      model: openai('gpt-4o'),
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

    await agent.generateVNext('Hello, world!', {
      threadId,
      resourceId,
    });

    const agentMemory = (await agent.getMemory())!;
    const { messages } = await agentMemory.query({ threadId });

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

  describe('should stream via useChat after tool call', () => {
    let mastraServer: ReturnType<typeof spawn>;
    let port: number;
    const threadId = randomUUID();
    const resourceId = 'test-resource';

    beforeAll(async () => {
      port = await getAvailablePort();

      mastraServer = spawn(
        'pnpm',
        [
          path.resolve(import.meta.dirname, `..`, `..`, `..`, `cli`, `dist`, `index.js`),
          'dev',
          '--port',
          port.toString(),
        ],
        {
          stdio: 'pipe',
          detached: true, // Run in a new process group so we can kill it and children
        },
      );

      // Wait for server to be ready
      await new Promise<void>((resolve, reject) => {
        let output = '';
        mastraServer.stdout?.on('data', data => {
          output += data.toString();
          console.log(output);
          if (output.includes('http://localhost:')) {
            resolve();
          }
        });
        mastraServer.stderr?.on('data', data => {
          console.error('Mastra server error:', data.toString());
        });

        setTimeout(() => reject(new Error('Mastra server failed to start')), 100000);
      });
    });

    afterAll(() => {
      // Kill the server and its process group
      if (mastraServer?.pid) {
        try {
          process.kill(-mastraServer.pid, 'SIGTERM');
        } catch (e) {
          console.error('Failed to kill Mastra server:', e);
        }
      }
    });

    it('should stream via useChat after tool call', async () => {
      let error: Error | null = null;
      const { result } = renderHook(() => {
        const chat = useChat({
          transport: new DefaultChatTransport({
            api: `http://localhost:${port}/api/agents/test/stream/vnext/ui`,
            prepareSendMessagesRequest({ messages }) {
              return {
                body: {
                  messages: [messages.at(-1)],
                  threadId,
                  resourceId,
                },
              };
            },
          }),
          onFinish(message) {
            console.log('useChat finished', message);
          },
          onError(e) {
            error = e;
            console.error('useChat error:', error);
          },
        });
        return chat;
      });

      let messageCount = 0;
      async function expectResponse({ message, responseContains }: { message: string; responseContains: string[] }) {
        messageCount++;
        await act(async () => {
          await result.current.sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: message }],
          });
        });
        const responseIndex = messageCount * 2 - 1;
        await waitFor(
          () => {
            expect(error).toBeNull();
            expect(result.current.messages).toHaveLength(messageCount * 2);
            for (const should of responseContains) {
              expect(
                result.current.messages[responseIndex].parts.map(p => (`text` in p ? p.text : '')).join(``),
              ).toContain(should);
            }
          },
          { timeout: 1000 },
        );
      }

      await expectResponse({
        message: 'what is the weather in Los Angeles?',
        responseContains: ['Los Angeles', '70'],
      });

      await expectResponse({
        message: 'what is the weather in Seattle?',
        responseContains: ['Seattle', '70'],
      });
    });

    it('should stream useChat with client side tool calling', async () => {
      let error: Error | null = null;
      const threadId = randomUUID();

      await weatherAgent.generateVNext(`hi`, {
        threadId,
        resourceId,
      });
      await weatherAgent.generateVNext(`LA weather`, { threadId, resourceId });

      const agentMemory = (await weatherAgent.getMemory())!;
      const initialMessages = (await agentMemory.query({ threadId })).uiMessages;
      const state = { clipboard: '' };
      const { result } = renderHook(() => {
        const chat = useChat({
          transport: new DefaultChatTransport({
            api: `http://localhost:${port}/api/agents/test/stream/vnext/ui`,
            prepareSendMessagesRequest({ messages }) {
              return {
                body: {
                  messages: [messages.at(-1)],
                  threadId,
                  resourceId,
                },
              };
            },
          }),
          messages: initialMessages as UIMessage[],
          onFinish(message) {
            console.log('useChat finished', message);
          },
          onError(e) {
            error = e;
            console.error('useChat error:', error);
          },
          onToolCall: async ({ toolCall }) => {
            console.log(toolCall);
            if (toolCall.toolName === `clipboard`) {
              await new Promise(res => setTimeout(res, 10));
              return state.clipboard as any as void;
            }
          },
        });
        return chat;
      });

      async function expectResponse({ message, responseContains }: { message: string; responseContains: string[] }) {
        const messageCountBefore = result.current.messages.length;
        await act(async () => {
          await result.current.sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: message }],
          });
        });

        // Wait for message count to increase
        await waitFor(
          () => {
            expect(error).toBeNull();
            expect(result.current.messages.length).toBeGreaterThan(messageCountBefore);
          },
          { timeout: 2000 },
        );

        // Get fresh reference to messages after all waits complete
        const uiMessages = result.current.messages;
        const latestMessage = uiMessages.at(-1);
        if (!latestMessage) throw new Error(`No latest message`);
        if (
          latestMessage.role === `assistant` &&
          latestMessage.parts.length === 2 &&
          latestMessage.parts[1].type === `tool-clipboard`
        ) {
          // client side tool call
          return;
        }
        for (const should of responseContains) {
          let searchString = latestMessage.parts.map(p => (`text` in p ? p.text : ``)).join(``);

          for (const part of latestMessage.parts) {
            if (part.type === `text`) {
              searchString += `\n${part.text}`;
            }
            if (isToolUIPart(part)) {
              searchString += `\n${JSON.stringify(part)}`;
            }
          }

          expect(searchString).toContain(should);
        }
      }

      state.clipboard = `test 1!`;
      await expectResponse({
        message: 'whats in my clipboard?',
        responseContains: [state.clipboard],
      });
      await expectResponse({
        message: 'weather in Las Vegas',
        responseContains: ['Las Vegas', '70'],
      });
      state.clipboard = `test 2!`;
      await expectResponse({
        message: 'whats in my clipboard?',
        responseContains: [state.clipboard],
      });
      state.clipboard = `test 3!`;
      await expectResponse({
        message: 'whats in my clipboard now?',
        responseContains: [state.clipboard],
      });
    });
  });
});
