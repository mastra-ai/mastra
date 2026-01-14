import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { useChat } from '@ai-sdk/react';
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { MastraClient } from '@mastra/client-js';
import { AIV4Adapter, AIV5Adapter } from '@mastra/core/agent/message-list';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Message } from 'ai';
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls } from 'ai-v5';
import type { UIMessage } from 'ai-v5';
import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { weatherAgent } from '../v4/mastra/agents/weather';
import { weatherAgent as weatherAgentV5 } from '../v5/mastra/agents/weather';

// Set up JSDOM environment for React testing
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

// @ts-ignore - JSDOM types don't match exactly but this works for testing
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  writable: false,
});
(globalThis as any).fetch = (globalThis as any).fetch || fetch;

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

export function setupUseChatV4() {
  describe('should stream via useChat after tool call', () => {
    let mastraServer: ReturnType<typeof spawn>;
    let port: number;
    const threadId = randomUUID();
    const resourceId = 'test-resource';

    beforeAll(async () => {
      port = await getAvailablePort();

      const mastraDir = path.resolve(import.meta.dirname, `..`, `v4`, `mastra`);
      mastraServer = spawn(
        process.execPath,
        [
          path.resolve(import.meta.dirname, `..`, `..`, `..`, `..`, `cli`, `dist`, `index.js`),
          'dev',
          '--dir',
          mastraDir,
        ],
        {
          stdio: 'pipe',
          detached: true, // Run in a new process group so we can kill it and children
          env: {
            ...process.env,
            PORT: port.toString(),
          },
        },
      );

      // Wait for server to be ready
      await new Promise<void>((resolve, reject) => {
        let output = '';
        mastraServer.stdout?.on('data', data => {
          output += data.toString();
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
          api: `http://localhost:${port}/api/agents/test/stream-legacy`,
          experimental_prepareRequestBody({ messages }: { messages: Message[]; id: string }) {
            return {
              messages: [messages.at(-1)],
              threadId,
              resourceId,
            };
          },
          onFinish(message) {
            console.info('useChat finished', message.id);
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
          await result.current.append({
            role: 'user',
            content: message,
          });
        });
        const responseIndex = messageCount * 2 - 1;
        await waitFor(
          () => {
            expect(error).toBeNull();
            expect(result.current.messages).toHaveLength(messageCount * 2);
            for (const should of responseContains) {
              expect(result.current.messages[responseIndex].content).toContain(should);
            }
          },
          { timeout: 1000 },
        );
      }

      await expectResponse({
        message: 'what is the weather in Los Angeles?',
        responseContains: ['Los Angeles', '70 degrees'],
      });

      await expectResponse({
        message: 'what is the weather in Seattle?',
        responseContains: ['Seattle', '70 degrees'],
      });
    });

    it('should stream useChat with client side tool calling', async () => {
      let error: Error | null = null;
      const threadId = randomUUID();

      await weatherAgent.generateLegacy(`hi`, {
        threadId,
        resourceId,
      });
      await weatherAgent.generateLegacy(`LA weather`, { threadId, resourceId });

      const agentMemory = (await weatherAgent.getMemory())!;
      // Get initial messages from memory and convert to AI SDK v4 format
      const { messages } = await agentMemory.recall({ threadId });
      const initialMessages = messages.map(m => AIV4Adapter.toUIMessage(m)) as Message[];
      const state = { clipboard: '' };
      const { result } = renderHook(() => {
        const chat = useChat({
          api: `http://localhost:${port}/api/agents/test/stream-legacy`,
          initialMessages,
          experimental_prepareRequestBody({ messages }: { messages: Message[]; id: string }) {
            return {
              messages: [messages.at(-1)],
              threadId,
              resourceId,
            };
          },
          onFinish(message) {
            console.info('useChat finished', message.id);
          },
          onError(e) {
            error = e;
            console.error('useChat error:', error);
          },
          onToolCall: async ({ toolCall }) => {
            if (toolCall.toolName === `clipboard`) {
              await new Promise(res => setTimeout(res, 10));
              return state.clipboard;
            }
          },
        });
        return chat;
      });

      async function expectResponse({ message, responseContains }: { message: string; responseContains: string[] }) {
        const messageCountBefore = result.current.messages.length;
        await act(async () => {
          await result.current.append({
            role: 'user',
            content: message,
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
          latestMessage.parts[1].type === `tool-invocation`
        ) {
          // client side tool call
          return;
        }
        for (const should of responseContains) {
          let searchString = typeof latestMessage.content === `string` ? latestMessage.content : ``;

          for (const part of latestMessage.parts) {
            if (part.type === `text`) {
              searchString += `\n${part.text}`;
            }
            if (part.type === `tool-invocation`) {
              searchString += `\n${JSON.stringify(part.toolInvocation)}`;
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
        responseContains: ['Las Vegas', '70 degrees'],
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
}

export function setupUseChatV5Plus({ useChatFunc, version }: { useChatFunc: any; version: 'v5' | 'v6' }) {
  describe('should stream via useChat after tool call (v5+)', () => {
    let mastraServer: ReturnType<typeof spawn>;
    let port: number;
    const threadId = randomUUID();
    const resourceId = 'test-resource';

    beforeAll(async () => {
      port = await getAvailablePort();

      const mastraDir = path.resolve(import.meta.dirname, `..`, version, `mastra`);
      mastraServer = spawn(
        process.execPath,
        [
          path.resolve(import.meta.dirname, `..`, `..`, `..`, `..`, `cli`, `dist`, `index.js`),
          'dev',
          '--dir',
          mastraDir,
        ],
        {
          stdio: 'pipe',
          detached: true,
          env: {
            ...process.env,
            PORT: port.toString(),
          },
        },
      );

      await new Promise<void>((resolve, reject) => {
        let output = '';
        mastraServer.stdout?.on('data', data => {
          output += data.toString();
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
        const chat = useChatFunc({
          transport: new DefaultChatTransport({
            api: `http://localhost:${port}/chat`,
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
          onFinish(message: any) {
            console.info('useChat finished', message);
          },
          onError(e: any) {
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
                result.current.messages[responseIndex].parts.map((p: any) => (`text` in p ? p.text : '')).join(``),
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
      const localThreadId = randomUUID();

      await weatherAgentV5.generate(`hi`, {
        memory: { thread: localThreadId, resource: resourceId },
      });

      const agentMemory = (await weatherAgentV5.getMemory())!;
      const dbMessages = (await agentMemory.recall({ threadId: localThreadId })).messages;
      const initialMessages = dbMessages.map(m => AIV5Adapter.toUIMessage(m));
      const state = { clipboard: '' };
      const { result } = renderHook(() => {
        const chat = useChatFunc({
          transport: new DefaultChatTransport({
            api: `http://localhost:${port}/chat`,
            prepareSendMessagesRequest({ messages }) {
              return {
                body: {
                  messages: [messages.at(-1)],
                  threadId: localThreadId,
                  resourceId,
                },
              };
            },
          }),
          messages: initialMessages,
          onFinish(message: any) {
            console.info('useChat finished', message);
          },
          onError(e: any) {
            error = e;
            console.error('useChat error:', error);
          },
          sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
          onToolCall: ({ toolCall }: { toolCall: any }) => {
            if (toolCall.dynamic) {
              return;
            }
            if (toolCall.toolName === `clipboard`) {
              chat.addToolResult({
                state: 'output-available',
                toolCallId: toolCall.toolCallId,
                tool: toolCall.toolName,
                output: state.clipboard,
              });
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

        await waitFor(
          () => {
            expect(error).toBeNull();
            expect(result.current.messages.length).toBeGreaterThan(messageCountBefore);
          },
          { timeout: 2000 },
        );

        const uiMessages = result.current.messages;
        const latestMessage = uiMessages.at(-1);
        if (!latestMessage) throw new Error(`No latest message`);
        if (
          latestMessage.role === `assistant` &&
          latestMessage.parts.length === 2 &&
          (latestMessage.parts[1] as any).type === `tool-clipboard`
        ) {
          return;
        }
        for (const should of responseContains) {
          let searchString = latestMessage.parts.map((p: any) => (`text` in p ? p.text : ``)).join(``);

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

      // Use MastraClient to recall messages from the server's memory (not the test's local memory)
      // This is necessary because the server and test run in different processes with different databases
      const mastraClient = new MastraClient({ baseUrl: `http://localhost:${port}` });
      const messagesResult = await mastraClient
        .getMemoryThread({ threadId: localThreadId, agentId: 'test' })
        .listMessages({ resourceId });

      const clipboardToolInvocation = messagesResult.messages.filter(
        m =>
          m.role === 'assistant' &&
          m.content.parts.some(p => p.type === 'tool-invocation' && p.toolInvocation.toolName === 'clipboard'),
      );
      expect(clipboardToolInvocation.length).toBeGreaterThan(0);
    });

    it('should not create duplicate assistant messages', async () => {
      const testThreadId = randomUUID();
      const testResourceId = 'test-user-exact-flow-11091';
      const mastraClient = new MastraClient({ baseUrl: `http://localhost:${port}` });

      const { result } = renderHook(() => {
        const chat = useChatFunc({
          transport: new DefaultChatTransport({
            api: `http://localhost:${port}/chat/progress`,
            async prepareSendMessagesRequest({ messages, body }) {
              return {
                body: {
                  messages,
                  body,
                  memory: {
                    thread: testThreadId,
                    resource: testResourceId,
                  },
                },
              };
            },
          }),
        });
        return chat;
      });

      await act(async () => {
        await result.current.sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Run a task called "first-task"' }],
        });
      });

      await waitFor(
        () => {
          expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
        },
        { timeout: 30000 },
      );

      await act(async () => {
        await result.current.sendMessage({
          role: 'user',
          parts: [{ type: 'text', text: 'Run another task called "second-task"' }],
        });
      });

      await waitFor(
        () => {
          expect(result.current.messages.length).toBeGreaterThanOrEqual(4);
        },
        { timeout: 30000 },
      );

      const { messages: storageMessages } = await mastraClient.listThreadMessages(testThreadId, {
        agentId: 'progress',
      });

      const uiMessages: UIMessage[] = toAISdkV5Messages(storageMessages);

      const assistantMessages = uiMessages.filter(m => m.role === 'assistant');
      const userMessages = uiMessages.filter(m => m.role === 'user');

      expect(uiMessages.length).toBe(4);
      expect(userMessages.length).toBe(2);
      expect(assistantMessages.length).toBe(2);

      const storageAssistantIds = storageMessages
        .filter((m: any) => m.role === 'assistant')
        .map((m: any) => m.id)
        .sort();
      const uiAssistantIds = assistantMessages.map(m => m.id).sort();

      expect(uiAssistantIds).toEqual(storageAssistantIds);

      for (const id of uiAssistantIds) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }

      await mastraClient.getMemoryThread({ threadId: testThreadId, agentId: 'progress' }).delete();
    });
  });
}
