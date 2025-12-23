import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { UUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { openai } from '@ai-sdk/openai';
import { useChat } from '@ai-sdk/react';
import { Agent, MessageList } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Message } from 'ai';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { memory, weatherAgent } from './v4/mastra/agents/weather';
import { weatherTool } from './v4/mastra/tools/weather';
import { setupStreamingMemoryTest } from './shared/streaming-memory';

setupStreamingMemoryTest({
  model: openai('gpt-4o'),
  memory,
  tools: { get_weather: weatherTool },
});

setupStreamingMemoryTest({
  model: 'openai/gpt-4o',
  memory,
  tools: { get_weather: weatherTool },
});

// // Set up JSDOM environment for React testing
// const dom = new JSDOM('<!doctype html><html><body></body></html>', {
//   url: 'http://localhost',
//   pretendToBeVisual: true,
//   resources: 'usable',
// });
// // @ts-ignore - JSDOM types don't match exactly but this works for testing
// global.window = dom.window;
// global.document = dom.window.document;
// Object.defineProperty(global, 'navigator', {
//   value: dom.window.navigator,
//   writable: false,
// });
// global.fetch = global.fetch || fetch;

// describe('Memory Streaming Tests', () => {

//   describe('should stream via useChat after tool call', () => {
//     let mastraServer: ReturnType<typeof spawn>;
//     let port: number;
//     const threadId = randomUUID();
//     const resourceId = 'test-resource';

//     beforeAll(async () => {
//       port = await getAvailablePort();

//       mastraServer = spawn(
//         'pnpm',
//         [path.resolve(import.meta.dirname, `..`, `..`, `..`, `cli`, `dist`, `index.js`), 'dev'],
//         {
//           stdio: 'pipe',
//           detached: true, // Run in a new process group so we can kill it and children
//           env: {
//             ...process.env,
//             PORT: port.toString(),
//           },
//         },
//       );

//       // Wait for server to be ready
//       await new Promise<void>((resolve, reject) => {
//         let output = '';
//         mastraServer.stdout?.on('data', data => {
//           output += data.toString();
//           console.log(output);
//           if (output.includes('http://localhost:')) {
//             resolve();
//           }
//         });
//         mastraServer.stderr?.on('data', data => {
//           console.error('Mastra server error:', data.toString());
//         });

//         setTimeout(() => reject(new Error('Mastra server failed to start')), 100000);
//       });
//     });

//     afterAll(() => {
//       // Kill the server and its process group
//       if (mastraServer?.pid) {
//         try {
//           process.kill(-mastraServer.pid, 'SIGTERM');
//         } catch (e) {
//           console.error('Failed to kill Mastra server:', e);
//         }
//       }
//     });

//     it('should stream via useChat after tool call', async () => {
//       let error: Error | null = null;
//       const { result } = renderHook(() => {
//         const chat = useChat({
//           api: `http://localhost:${port}/api/agents/test/stream-legacy`,
//           experimental_prepareRequestBody({ messages }: { messages: Message[]; id: string }) {
//             return {
//               messages: [messages.at(-1)],
//               threadId,
//               resourceId,
//             };
//           },
//           onFinish(message) {
//             console.log('useChat finished', message.id);
//           },
//           onError(e) {
//             error = e;
//             console.error('useChat error:', error);
//           },
//         });
//         return chat;
//       });

//       let messageCount = 0;
//       async function expectResponse({ message, responseContains }: { message: string; responseContains: string[] }) {
//         messageCount++;
//         await act(async () => {
//           await result.current.append({
//             role: 'user',
//             content: message,
//           });
//         });
//         const responseIndex = messageCount * 2 - 1;
//         await waitFor(
//           () => {
//             expect(error).toBeNull();
//             expect(result.current.messages).toHaveLength(messageCount * 2);
//             for (const should of responseContains) {
//               expect(result.current.messages[responseIndex].content).toContain(should);
//             }
//           },
//           { timeout: 1000 },
//         );
//       }

//       await expectResponse({
//         message: 'what is the weather in Los Angeles?',
//         responseContains: ['Los Angeles', '70 degrees'],
//       });

//       await expectResponse({
//         message: 'what is the weather in Seattle?',
//         responseContains: ['Seattle', '70 degrees'],
//       });
//     });

//     it('should stream useChat with client side tool calling', async () => {
//       let error: Error | null = null;
//       const threadId = randomUUID();

//       await weatherAgent.generateLegacy(`hi`, {
//         threadId,
//         resourceId,
//       });
//       await weatherAgent.generateLegacy(`LA weather`, { threadId, resourceId });

//       const agentMemory = (await weatherAgent.getMemory())!;
//       // Get initial messages from memory and convert to AI SDK v4 format
//       const { messages } = await agentMemory.recall({ threadId });
//       const initialMessages = messages.map(m => MessageList.mastraDBMessageToAIV4UIMessage(m)) as Message[];
//       const state = { clipboard: '' };
//       const { result } = renderHook(() => {
//         const chat = useChat({
//           api: `http://localhost:${port}/api/agents/test/stream-legacy`,
//           initialMessages,
//           experimental_prepareRequestBody({ messages }: { messages: Message[]; id: string }) {
//             return {
//               messages: [messages.at(-1)],
//               threadId,
//               resourceId,
//             };
//           },
//           onFinish(message) {
//             console.log('useChat finished', message.id);
//           },
//           onError(e) {
//             error = e;
//             console.error('useChat error:', error);
//           },
//           onToolCall: async ({ toolCall }) => {
//             console.log(toolCall);
//             if (toolCall.toolName === `clipboard`) {
//               await new Promise(res => setTimeout(res, 10));
//               return state.clipboard;
//             }
//           },
//         });
//         return chat;
//       });

//       async function expectResponse({ message, responseContains }: { message: string; responseContains: string[] }) {
//         const messageCountBefore = result.current.messages.length;
//         await act(async () => {
//           await result.current.append({
//             role: 'user',
//             content: message,
//           });
//         });

//         // Wait for message count to increase
//         await waitFor(
//           () => {
//             expect(error).toBeNull();
//             expect(result.current.messages.length).toBeGreaterThan(messageCountBefore);
//           },
//           { timeout: 2000 },
//         );

//         // Get fresh reference to messages after all waits complete
//         const uiMessages = result.current.messages;
//         const latestMessage = uiMessages.at(-1);
//         if (!latestMessage) throw new Error(`No latest message`);
//         if (
//           latestMessage.role === `assistant` &&
//           latestMessage.parts.length === 2 &&
//           latestMessage.parts[1].type === `tool-invocation`
//         ) {
//           // client side tool call
//           return;
//         }
//         for (const should of responseContains) {
//           let searchString = typeof latestMessage.content === `string` ? latestMessage.content : ``;

//           for (const part of latestMessage.parts) {
//             if (part.type === `text`) {
//               searchString += `\n${part.text}`;
//             }
//             if (part.type === `tool-invocation`) {
//               searchString += `\n${JSON.stringify(part.toolInvocation)}`;
//             }
//           }

//           expect(searchString).toContain(should);
//         }
//       }

//       state.clipboard = `test 1!`;
//       await expectResponse({
//         message: 'whats in my clipboard?',
//         responseContains: [state.clipboard],
//       });
//       await expectResponse({
//         message: 'weather in Las Vegas',
//         responseContains: ['Las Vegas', '70 degrees'],
//       });
//       state.clipboard = `test 2!`;
//       await expectResponse({
//         message: 'whats in my clipboard?',
//         responseContains: [state.clipboard],
//       });
//       state.clipboard = `test 3!`;
//       await expectResponse({
//         message: 'whats in my clipboard now?',
//         responseContains: [state.clipboard],
//       });
//     });
//   });
// });
