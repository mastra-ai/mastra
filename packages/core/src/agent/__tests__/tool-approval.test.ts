import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const mockStorage = new InMemoryStore();

export function toolApprovalAndSuspensionTests(version: 'v1' | 'v2') {
  const mockFindUser = vi.fn().mockImplementation(async data => {
    const list = [
      { name: 'Dero Israel', email: 'dero@mail.com' },
      { name: 'Ife Dayo', email: 'dayo@mail.com' },
      { name: 'Tao Feeq', email: 'feeq@mail.com' },
      { name: 'Joe', email: 'joe@mail.com' },
    ];

    const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
    if (!userInfo) return { message: 'User not found' };
    return userInfo;
  });

  describe('tool approval and suspension', () => {
    describe.skipIf(version === 'v1')('requireToolApproval (mock-based)', () => {
      it('should call findUserTool with requireToolApproval on tool and resume via stream when autoResumeSuspendedTools is true', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          requireApproval: true,
          execute: async input => {
            return mockFindUser(input) as Promise<Record<string, any>>;
          },
        });

        // Create a mock model that handles tool calls
        let callCount = 0;
        const mockModel = new MockLanguageModelV2({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
              // First call: return tool call for findUserTool
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'findUserTool',
                    input: '{"name":"Dero Israel"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            } else if (callCount === 2) {
              // Second call: return tool call for findUserTool with resumeData: { approved: true }
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-2',
                    toolName: 'findUserTool',
                    input: '{"name":"Dero Israel", "resumeData": { "approved": true }}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            } else {
              // Second call (after approval): return text response
              return {
                rawCall: { rawPrompt: null, rawSettings: {} },
                warnings: [],
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'User name is Dero Israel' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]),
              };
            }
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: mockModel,
          tools: { findUserTool },
          memory: new MockMemory(),
          defaultOptions: {
            autoResumeSuspendedTools: true,
          },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');
        const memory = {
          thread: randomUUID(),
          resource: randomUUID(),
        };

        const stream = await agentOne.stream('Find the user with name - Dero Israel', { memory });
        let toolName = '';
        for await (const _chunk of stream.fullStream) {
          if (_chunk.type === 'tool-call-approval') {
            toolName = _chunk.payload.toolName;
          }
        }
        if (toolName) {
          const resumeStream = await agentOne.stream('Approve', {
            memory,
          });
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

          const name = (toolCall?.result as any)?.name;

          expect(mockFindUser).toHaveBeenCalled();
          expect(name).toBe('Dero Israel');
          expect(toolName).toBe('findUserTool');
        }
      }, 500000);
    });
  });
}

toolApprovalAndSuspensionTests('v2');
