import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events';
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
            await new Promise(resolve => setTimeout(resolve, 20));
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
          goal: {},
          defaultOptions: {
            autoResumeSuspendedTools: true,
          },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
          pubsub: new EventEmitterPubSub(),
        });

        await mastra.startWorkers();

        try {
          const agentOne = mastra.getAgent('userAgent');
          const memory = {
            thread: randomUUID(),
            resource: randomUUID(),
          };
          await agentOne.setObjective('Find the user', {
            threadId: memory.thread,
            resourceId: memory.resource,
          });

          const stream = await agentOne.stream('Find the user with name - Dero Israel', { memory });
          let toolName = '';
          for await (const _chunk of stream.fullStream) {
            if (_chunk.type === 'tool-call-approval') {
              toolName = _chunk.payload.toolName;
            }
          }
          const durationAtApproval = (await agentOne.getObjective({ threadId: memory.thread }))?.activeDurationMs ?? 0;
          expect(durationAtApproval).toBeGreaterThan(0);
          await new Promise(resolve => setTimeout(resolve, 30));
          expect((await agentOne.getObjective({ threadId: memory.thread }))?.activeDurationMs).toBe(durationAtApproval);

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
            expect((await agentOne.getObjective({ threadId: memory.thread }))?.activeDurationMs).toBeGreaterThan(
              durationAtApproval,
            );
          }
        } finally {
          await mastra.stopWorkers();
        }
      }, 500000);

      it('should evaluate a function-valued global requireToolApproval per tool call', async () => {
        const execute = vi.fn().mockResolvedValue({ name: 'Dero Israel', email: 'dero@mail.com' });
        const findUserTool = createTool({
          id: 'find-user-tool',
          description: 'Returns the name and email for a user',
          inputSchema: z.object({ name: z.string() }),
          execute: async () => execute(),
        });

        const makeModel = () =>
          new MockLanguageModelV2({
            doStream: async () => ({
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
            }),
          });

        const makeAgent = () =>
          new Agent({
            id: 'global-approval-agent',
            name: 'Global Approval Agent',
            instructions: 'You can look up users.',
            model: makeModel(),
            tools: { findUserTool },
            memory: new MockMemory(),
          });

        // Case 1: the policy returns true → the tool call suspends for approval and does not execute.
        const approveAll = vi.fn().mockReturnValue(true);
        const suspendingAgent = makeAgent();
        const suspendStream = await suspendingAgent.stream('Find the user with name - Dero Israel', {
          memory: { thread: randomUUID(), resource: randomUUID() },
          requireToolApproval: approveAll,
        });
        let approvedToolName = '';
        for await (const chunk of suspendStream.fullStream) {
          if (chunk.type === 'tool-call-approval') {
            approvedToolName = chunk.payload.toolName;
          }
        }
        expect(approveAll).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: 'findUserTool', args: { name: 'Dero Israel' } }),
        );
        expect(approvedToolName).toBe('findUserTool');
        expect(execute).not.toHaveBeenCalled();

        // Case 2: the policy returns false → the tool runs without requiring approval.
        const denyApproval = vi.fn().mockReturnValue(false);
        const runningAgent = makeAgent();
        const runStream = await runningAgent.stream('Find the user with name - Dero Israel', {
          memory: { thread: randomUUID(), resource: randomUUID() },
          requireToolApproval: denyApproval,
        });
        let sawApproval = false;
        for await (const chunk of runStream.fullStream) {
          if (chunk.type === 'tool-call-approval') {
            sawApproval = true;
          }
        }
        expect(denyApproval).toHaveBeenCalled();
        expect(sawApproval).toBe(false);
        expect(execute).toHaveBeenCalled();
      }, 500000);

      it('honors a function-valued global requireToolApproval across suspend and resume', async () => {
        // The function policy lives only in the live JS call (RequestContext.toJSON strips it from
        // the persisted suspend snapshot). This proves the resume call re-supplies and re-evaluates
        // the function, so approval survives a real suspend -> resume cycle without serialization.
        let callCount = 0;
        const mockModel = new MockLanguageModelV2({
          doStream: async () => {
            callCount++;
            if (callCount === 1) {
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
            }
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
          },
        });

        const findUserTool = createTool({
          id: 'find-user-tool',
          description: 'Returns the name and email for a user',
          inputSchema: z.object({ name: z.string() }),
          execute: async input => mockFindUser(input) as Promise<Record<string, any>>,
        });

        const resumeAgent = new Agent({
          id: 'resume-approval-agent',
          name: 'Resume Approval Agent',
          instructions: 'You can look up users.',
          model: mockModel,
          tools: { findUserTool },
          memory: new MockMemory(),
        });

        const mastra = new Mastra({ agents: { resumeAgent }, logger: false, storage: mockStorage });
        const agent = mastra.getAgent('resumeAgent');
        const memory = { thread: randomUUID(), resource: randomUUID() };
        const requireToolApproval = vi.fn().mockReturnValue(true);

        mockFindUser.mockClear();

        // First call: the function policy requires approval, so the tool suspends.
        const suspendStream = await agent.stream('Find the user with name - Dero Israel', {
          memory,
          requireToolApproval,
        });
        let toolName = '';
        for await (const chunk of suspendStream.fullStream) {
          if (chunk.type === 'tool-call-approval') {
            toolName = chunk.payload.toolName;
          }
        }
        expect(toolName).toBe('findUserTool');
        expect(mockFindUser).not.toHaveBeenCalled();

        // Resume call: re-supplies the same function policy. Approval is granted, tool executes.
        const resumeStream = await agent.stream('Approve', { memory, requireToolApproval });
        for await (const _chunk of resumeStream.fullStream) {
          // drain
        }
        const toolResults = await resumeStream.toolResults;
        const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

        // The policy was evaluated on both the suspend and resume passes (function survived resume).
        expect(requireToolApproval.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(mockFindUser).toHaveBeenCalled();
        expect((toolCall?.result as any)?.name).toBe('Dero Israel');
      }, 500000);
    });
  });
}

describe('goal activity at tool approval', () => {
  it('checkpoints active duration before a raw Agent exposes the approval wait', async () => {
    const storage = new InMemoryStore();
    const tool = createTool({
      id: 'approvalTool',
      description: 'A tool that requires approval',
      inputSchema: z.object({ value: z.string() }),
      requireApproval: true,
      execute: async input => input,
    });
    const model = new MockLanguageModelV2({
      doStream: async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'approvalTool',
              input: '{"value":"test"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      },
    });
    const rawAgent = new Agent({
      id: 'goal-approval-agent',
      name: 'Goal Approval Agent',
      instructions: 'Use the tool.',
      model,
      tools: { approvalTool: tool },
      goal: {},
    });
    const mastra = new Mastra({ agents: { rawAgent }, storage, logger: false });
    const agent = mastra.getAgent('rawAgent');
    const memory = { thread: randomUUID(), resource: randomUUID() };
    await agent.setObjective('Finish after approval', { threadId: memory.thread, resourceId: memory.resource });

    const result = await agent.stream('Use the approval tool', { memory });
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call-approval') break;
    }

    expect((await agent.getObjective({ threadId: memory.thread }))?.activeDurationMs).toBeGreaterThan(0);
  });
});

toolApprovalAndSuspensionTests('v2');
