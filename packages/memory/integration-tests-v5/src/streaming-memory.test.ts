import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { UUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { openai } from '@ai-sdk/openai';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@internal/ai-sdk-v5';
import { toAISdkStream } from '@mastra/ai-sdk';
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { MastraClient } from '@mastra/client-js';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DefaultChatTransport, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { JSDOM } from 'jsdom';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { memory, weatherAgent } from './mastra/agents/weather';
import { weatherTool } from './mastra/tools/weather';

describe('Memory Streaming Tests', () => {
  describe('should stream via useChat after tool call', () => {
    let mastraServer: ReturnType<typeof spawn>;
    let port: number;
    const threadId = randomUUID();
    const resourceId = 'test-resource';

    beforeAll(async () => {
      port = await getAvailablePort();

      mastraServer = spawn(
        'pnpm',
        [path.resolve(import.meta.dirname, `..`, `..`, `..`, `cli`, `dist`, `index.js`), 'dev'],
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

      await weatherAgent.generate(`hi`, {
        threadId,
        resourceId,
      });

      const agentMemory = (await weatherAgent.getMemory())!;
      const dbMessages = (await agentMemory.recall({ threadId })).messages;
      const initialMessages = dbMessages.map(m => MessageList.mastraDBMessageToAIV5UIMessage(m));
      const state = { clipboard: '' };
      const { result } = renderHook(() => {
        const chat = useChat({
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
          messages: initialMessages,
          onFinish(message) {
            console.log('useChat finished', message);
          },
          onError(e) {
            error = e;
            console.error('useChat error:', error);
          },
          sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
          onToolCall: ({ toolCall }) => {
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

      const messagesResult = await agentMemory.recall({ threadId, resourceId });

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
        const chat = useChat({
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

      // Turn 1
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

      // Turn 2
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

      // Should have exactly 4 messages: 2 user + 2 assistant (no duplicates)
      expect(uiMessages.length).toBe(4);
      expect(userMessages.length).toBe(2);
      expect(assistantMessages.length).toBe(2);

      // Verify that assistant message IDs from storage match UI message IDs
      const storageAssistantIds = storageMessages
        .filter((m: any) => m.role === 'assistant')
        .map((m: any) => m.id)
        .sort();
      const uiAssistantIds = assistantMessages.map(m => m.id).sort();

      expect(uiAssistantIds).toEqual(storageAssistantIds);

      // Verify all IDs are UUIDs (not nanoids)
      for (const id of uiAssistantIds) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }

      // Clean up
      await mastraClient.getMemoryThread({ threadId: testThreadId, agentId: 'progress' }).delete();
    });
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
      const assistantMessages = recallResult.messages.filter(
        (m: MastraDBMessage) => m.role === 'assistant',
      ) as MastraDBMessage[];
      expect(assistantMessages.length).toBe(2);

      // Check first assistant message has data-upload-progress
      const uploadProgressMsg = assistantMessages.find((m: MastraDBMessage) =>
        m.content.parts.some((p: any) => p.type === 'data-upload-progress'),
      );
      expect(uploadProgressMsg).toBeDefined();
      const uploadProgressPart = uploadProgressMsg!.content.parts.find((p: any) => p.type === 'data-upload-progress');
      expect(uploadProgressPart).toBeDefined();
      expect((uploadProgressPart as any).data.progress).toBe(50);

      // Check second assistant message has data-file-reference
      const fileRefMsg = assistantMessages.find((m: MastraDBMessage) =>
        m.content.parts.some((p: any) => p.type === 'data-file-reference'),
      );
      expect(fileRefMsg).toBeDefined();
      const fileRefPart = fileRefMsg!.content.parts.find((p: any) => p.type === 'data-file-reference');
      expect(fileRefPart).toBeDefined();
      expect((fileRefPart as any).data.fileId).toBe('file-123');

      // Now convert to AIV5 UI format (this is what the frontend would receive)
      const uiMessages: UIMessage[] = recallResult.messages.map((m: MastraDBMessage) =>
        MessageList.mastraDBMessageToAIV5UIMessage(m),
      );

      expect(uiMessages.length).toBe(3);

      // Verify data-* parts are preserved in UI format
      const uiAssistantMessages = uiMessages.filter((m: UIMessage) => m.role === 'assistant');
      expect(uiAssistantMessages.length).toBe(2);

      // Check data-upload-progress is preserved in UI format
      const uiUploadProgressMsg = uiAssistantMessages.find((m: UIMessage) =>
        m.parts.some((p: any) => p.type === 'data-upload-progress'),
      );
      expect(uiUploadProgressMsg).toBeDefined();
      const uiUploadProgressPart = uiUploadProgressMsg!.parts.find((p: any) => p.type === 'data-upload-progress');
      expect(uiUploadProgressPart).toBeDefined();
      expect((uiUploadProgressPart as any).data.progress).toBe(50);
      expect((uiUploadProgressPart as any).data.fileName).toBe('document.pdf');

      // Check data-file-reference is preserved in UI format
      const uiFileRefMsg = uiAssistantMessages.find((m: UIMessage) =>
        m.parts.some((p: any) => p.type === 'data-file-reference'),
      );
      expect(uiFileRefMsg).toBeDefined();
      const uiFileRefPart = uiFileRefMsg!.parts.find((p: any) => p.type === 'data-file-reference');
      expect(uiFileRefPart).toBeDefined();
      expect((uiFileRefPart as any).data.fileId).toBe('file-123');
      expect((uiFileRefPart as any).data.fileName).toBe('document.pdf');

      // Clean up
      await memory.deleteThread(threadId);
    });
  });
});
