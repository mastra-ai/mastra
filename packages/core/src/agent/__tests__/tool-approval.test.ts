import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';
import { convertArrayToReadableStream, getOpenAIModel, MockLanguageModelV2 } from './mock-model';

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
    const openaiModel = getOpenAIModel(version);
    describe.skipIf(version === 'v1')('requireToolApproval', () => {
      it('should call findUserTool with requireToolApproval on tool and be able to reject the tool call', async () => {
        mockFindUser.mockClear(); // Reset mock call count before this test

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

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        const stream = await agentOne.stream('Find the user with name - Dero Israel', {
          requireToolApproval: true,
        });
        let toolCallId = '';
        for await (const _chunk of stream.fullStream) {
          if (_chunk.type === 'tool-call-approval') {
            toolCallId = _chunk.payload.toolCallId;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const resumeStream = await agentOne.declineToolCall({ runId: stream.runId, toolCallId });
        for await (const _chunk of resumeStream.fullStream) {
          // console.log(_chunk);
        }

        const toolResults = await resumeStream.toolResults;

        expect((await resumeStream.toolCalls).length).toBe(1);
        expect(toolResults.length).toBe(1);
        expect(toolResults[0].payload?.result).toBe('Tool call was not approved by the user');
        expect(mockFindUser).toHaveBeenCalledTimes(0);
      }, 500000);

      it('should call findUserTool with requireToolApproval on agent', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          execute: async input => {
            return mockFindUser(input) as Promise<Record<string, any>>;
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        let toolCall;
        let response;
        if (version === 'v1') {
          response = await agentOne.generateLegacy('Find the user with name - Dero Israel', {
            maxSteps: 2,
            toolChoice: 'required',
          });
          toolCall = response.toolResults.find((result: any) => result.toolName === 'findUserTool');
        } else {
          const stream = await agentOne.stream('Find the user with name - Dero Israel', {
            requireToolApproval: true,
          });
          let toolCallId = '';
          for await (const _chunk of stream.fullStream) {
            if (_chunk.type === 'tool-call-approval') {
              toolCallId = _chunk.payload.toolCallId;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          const resumeStream = await agentOne.approveToolCall({ runId: stream.runId, toolCallId });
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;
        }

        const name = toolCall?.result?.name;

        expect(mockFindUser).toHaveBeenCalled();
        expect(name).toBe('Dero Israel');
      }, 500000);

      it('should call findUserTool with requireToolApproval on tool', async () => {
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

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        let toolCall;
        let response;
        if (version === 'v1') {
          response = await agentOne.generateLegacy('Find the user with name - Dero Israel', {
            maxSteps: 2,
            toolChoice: 'required',
          });
          toolCall = response.toolResults.find((result: any) => result.toolName === 'findUserTool');
        } else {
          const stream = await agentOne.stream('Find the user with name - Dero Israel');
          let toolCallId = '';
          for await (const _chunk of stream.fullStream) {
            if (_chunk.type === 'tool-call-approval') {
              toolCallId = _chunk.payload.toolCallId;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          const resumeStream = await agentOne.approveToolCall({ runId: stream.runId, toolCallId });
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;
        }

        const name = toolCall?.result?.name;

        expect(mockFindUser).toHaveBeenCalled();
        expect(name).toBe('Dero Israel');
      }, 500000);

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

    describe.skipIf(version === 'v1')('suspension', () => {
      it('should call findUserTool with suspend and resume', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            name: z.string(),
          }),
          execute: async (inputData, context) => {
            // console.log('context', context);
            if (!context?.agent?.resumeData) {
              return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
            }

            return {
              name: context?.agent?.resumeData?.name,
              email: 'test@test.com',
            };
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        let toolCall;
        const stream = await agentOne.stream('Find the user with name - Dero Israel');
        for await (const _chunk of stream.fullStream) {
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        const resumeStream = await agentOne.resumeStream({ name: 'Dero Israel' }, { runId: stream.runId });
        for await (const _chunk of resumeStream.fullStream) {
        }

        const toolResults = await resumeStream.toolResults;

        toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

        const name = toolCall?.result?.name;
        const email = toolCall?.result?.email;

        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
      }, 15000);

      it('should call findUserTool with suspend and resume via generate', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            name: z.string(),
          }),
          execute: async (inputData, context) => {
            // console.log('context', context);
            if (!context?.agent?.resumeData) {
              return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
            }

            return {
              name: context?.agent?.resumeData?.name,
              email: 'test@test.com',
            };
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        const output = await agentOne.generate('Find the user with name - Dero Israel');

        expect(output.finishReason).toBe('suspended');
        expect(output.toolResults).toHaveLength(0);
        expect(output.suspendPayload).toMatchObject({
          toolName: 'findUserTool',
          suspendPayload: {
            message: 'Please provide the name of the user',
          },
        });

        const resumeOutput = await agentOne.resumeGenerate({ name: 'Dero Israel' }, { runId: output.runId });

        const toolResults = resumeOutput.toolResults;

        const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

        const name = (toolCall?.result as any)?.name;
        const email = (toolCall?.result as any)?.email;

        expect(resumeOutput.suspendPayload).toBeUndefined();
        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
      }, 15000);

      it('should call findUserTool with suspend and resume via stream when autoResumeSuspendedTools is true', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            age: z.number(),
          }),
          execute: async (inputData, context) => {
            // console.log('context', context);
            if (!context?.agent?.resumeData) {
              return await context?.agent?.suspend({ message: 'Please provide the age of the user' });
            }

            return {
              name: inputData.name,
              age: context?.agent?.resumeData?.age,
              email: 'test@test.com',
            };
          },
        });

        const findUserProfessionTool = createTool({
          id: 'Find user profession tool',
          description: 'This is a test tool that returns the profession of the user',
          inputSchema: z.object({
            name: z.string(),
          }),
          execute: async () => {
            return {
              profession: 'Software Engineer',
            };
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool, findUserProfessionTool },
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

        const suspendData = {
          suspendPayload: null,
          suspendedToolName: '',
        };
        const memory = {
          thread: randomUUID(),
          resource: randomUUID(),
        };
        const stream = await agentOne.stream('Find the name, age and profession of the user - Dero Israel', {
          memory,
        });
        for await (const _chunk of stream.fullStream) {
          if (_chunk.type === 'tool-call-suspended') {
            suspendData.suspendPayload = _chunk.payload.suspendPayload;
            suspendData.suspendedToolName = _chunk.payload.toolName;
          }
        }
        if (suspendData.suspendPayload) {
          const resumeStream = await agentOne.stream('He is 25 years old', {
            memory,
          });
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

          const name = (toolCall?.result as any)?.name;
          const email = (toolCall?.result as any)?.email;
          const age = (toolCall?.result as any)?.age;

          expect(name).toBe('Dero Israel');
          expect(email).toBe('test@test.com');
          expect(age).toBe(25);
        }

        expect(suspendData.suspendPayload).toBeDefined();
        expect(suspendData.suspendedToolName).toBe('findUserTool');
        expect((suspendData.suspendPayload as any)?.message).toBe('Please provide the age of the user');
      }, 15000);

      it('should call findUserTool with suspend and resume via generate when autoResumeSuspendedTools is true', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            age: z.number(),
          }),
          execute: async (inputData, context) => {
            // console.log('context', context);
            if (!context?.agent?.resumeData) {
              return await context?.agent?.suspend({ message: 'Please provide the age of the user' });
            }

            return {
              name: inputData.name,
              age: context?.agent?.resumeData?.age,
              email: 'test@test.com',
            };
          },
        });

        const findUserProfessionTool = createTool({
          id: 'Find user profession tool',
          description: 'This is a test tool that returns the profession of the user',
          inputSchema: z.object({
            name: z.string(),
          }),
          execute: async () => {
            return {
              profession: 'Software Engineer',
            };
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool, findUserProfessionTool },
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
        const output = await agentOne.generate('Find the name, age and profession of the user - Dero Israel', {
          memory,
        });

        expect(output.finishReason).toBe('suspended');
        expect(output.toolResults).toHaveLength(0);
        expect(output.suspendPayload).toMatchObject({
          toolName: 'findUserTool',
          suspendPayload: {
            message: 'Please provide the age of the user',
          },
        });
        const resumeOutput = await agentOne.generate('He is 25 years old', {
          memory,
        });

        const toolResults = resumeOutput.toolResults;

        const toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;

        const name = (toolCall?.result as any)?.name;
        const email = (toolCall?.result as any)?.email;
        const age = (toolCall?.result as any)?.age;

        expect(resumeOutput.suspendPayload).toBeUndefined();
        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
        expect(age).toBe(25);
      }, 15000);

      it('should call findUserWorkflow with suspend and resume', async () => {
        const findUserStep = createStep({
          id: 'find-user-step',
          description: 'This is a test step that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            name: z.string(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
          }),
          execute: async ({ suspend, resumeData }) => {
            if (!resumeData) {
              return await suspend({ message: 'Please provide the name of the user' });
            }

            return {
              name: resumeData?.name,
              email: 'test@test.com',
            };
          },
        });

        const findUserWorkflow = createWorkflow({
          id: 'find-user-workflow',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
          }),
        })
          .then(findUserStep)
          .commit();

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserWorkflow.',
          model: openaiModel,
          workflows: { findUserWorkflow },
          memory: new MockMemory(),
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        let toolCall;
        const stream = await agentOne.stream('Find the user with name - Dero Israel', {
          memory: {
            thread: 'test-thread-1',
            resource: 'test-resource-1',
          },
        });
        const suspendData = {
          suspendPayload: null,
          suspendedToolName: '',
        };
        for await (const _chunk of stream.fullStream) {
          if (_chunk.type === 'tool-call-suspended') {
            suspendData.suspendPayload = _chunk.payload.suspendPayload;
            suspendData.suspendedToolName = _chunk.payload.toolName;
          }
        }
        if (suspendData.suspendPayload) {
          const resumeStream = await agentOne.resumeStream(
            { name: 'Dero Israel' },
            {
              runId: stream.runId,
              memory: {
                thread: 'test-thread-1',
                resource: 'test-resource-1',
              },
            },
          );
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          toolCall = toolResults?.find(
            (result: any) => result.payload.toolName === 'workflow-findUserWorkflow',
          )?.payload;

          const name = toolCall?.result?.result?.name;
          const email = toolCall?.result?.result?.email;

          expect(name).toBe('Dero Israel');
          expect(email).toBe('test@test.com');
        }

        expect(suspendData.suspendPayload).toBeDefined();
        expect(suspendData.suspendedToolName).toBe('workflow-findUserWorkflow');
        expect((suspendData.suspendPayload as any)?.message).toBe('Please provide the name of the user');
      }, 15000);

      it('should call findUserWorkflow with suspend and resume via generate', async () => {
        const findUserStep = createStep({
          id: 'find-user-step',
          description: 'This is a test step that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            name: z.string(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
          }),
          execute: async ({ suspend, resumeData }) => {
            if (!resumeData) {
              return await suspend({ message: 'Please provide the name of the user' });
            }

            return {
              name: resumeData?.name,
              email: 'test@test.com',
            };
          },
        });

        const findUserWorkflow = createWorkflow({
          id: 'find-user-workflow',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
          }),
        })
          .then(findUserStep)
          .commit();

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserWorkflow.',
          model: openaiModel,
          workflows: { findUserWorkflow },
          memory: new MockMemory(),
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        const output = await agentOne.generate('Find the user with name - Dero Israel', {
          memory: {
            thread: 'test-thread-1',
            resource: 'test-resource-1',
          },
        });

        expect(output.finishReason).toBe('suspended');
        expect(output.toolResults).toHaveLength(0);
        expect(output.suspendPayload).toMatchObject({
          toolName: 'workflow-findUserWorkflow',
          suspendPayload: {
            message: 'Please provide the name of the user',
          },
        });

        const resumeOutput = await agentOne.resumeGenerate(
          { name: 'Dero Israel' },
          {
            runId: output.runId,
            memory: {
              thread: 'test-thread-1',
              resource: 'test-resource-1',
            },
          },
        );

        const toolResults = resumeOutput.toolResults;

        const toolCall = toolResults?.find(
          (result: any) => result.payload.toolName === 'workflow-findUserWorkflow',
        )?.payload;

        const name = (toolCall?.result as any)?.result?.name;
        const email = (toolCall?.result as any)?.result?.email;

        expect(resumeOutput.suspendPayload).toBeUndefined();
        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
      }, 15000);

      it('should call findUserWorkflow with suspend and resume via stream when autoResumeSuspendedTools is true', async () => {
        const findUserStep = createStep({
          id: 'find-user-step',
          description: 'This is a test step that returns the name, email and age',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            age: z.number(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
            age: z.number(),
          }),
          execute: async ({ suspend, resumeData, inputData }) => {
            if (!resumeData) {
              return await suspend({ message: 'Please provide the age of the user' });
            }

            return {
              name: inputData?.name,
              email: 'test@test.com',
              age: resumeData?.age,
            };
          },
        });

        const findUserWorkflow = createWorkflow({
          id: 'find-user-workflow',
          description: 'This is a test tool that returns the name, and age',
          inputSchema: z.object({
            name: z.string(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
            age: z.number(),
          }),
        })
          .then(findUserStep)
          .commit();

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserWorkflow.',
          model: openaiModel,
          workflows: { findUserWorkflow },
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

        let toolCall;
        const stream = await agentOne.stream('Find the user with name and age of - Dero Israel', {
          memory: {
            thread: 'test-thread',
            resource: 'test-resource',
          },
        });
        const suspendData = {
          suspendPayload: null,
          suspendedToolName: '',
        };
        for await (const _chunk of stream.fullStream) {
          if (_chunk.type === 'tool-call-suspended') {
            suspendData.suspendPayload = _chunk.payload.suspendPayload;
            suspendData.suspendedToolName = _chunk.payload.toolName;
          }
        }
        if (suspendData.suspendPayload) {
          const resumeStream = await agentOne.stream('He is 25 years old', {
            memory: {
              thread: 'test-thread',
              resource: 'test-resource',
            },
          });
          for await (const _chunk of resumeStream.fullStream) {
          }

          const toolResults = await resumeStream.toolResults;

          toolCall = toolResults?.find(
            (result: any) => result.payload.toolName === 'workflow-findUserWorkflow',
          )?.payload;

          const name = toolCall?.result?.result?.name;
          const email = toolCall?.result?.result?.email;
          const age = toolCall?.result?.result?.age;

          expect(name).toBe('Dero Israel');
          expect(email).toBe('test@test.com');
          expect(age).toBe(25);
        }

        expect(suspendData.suspendPayload).toBeDefined();
        expect(suspendData.suspendedToolName).toBe('workflow-findUserWorkflow');
        expect((suspendData.suspendPayload as any)?.message).toBe('Please provide the age of the user');
      }, 15000);

      it('should call findUserWorkflow with suspend and resume via generate when autoResumeSuspendedTools is true', async () => {
        const findUserStep = createStep({
          id: 'find-user-step',
          description: 'This is a test step that returns the name, email and age',
          inputSchema: z.object({
            name: z.string(),
          }),
          suspendSchema: z.object({
            message: z.string(),
          }),
          resumeSchema: z.object({
            age: z.number(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
            age: z.number(),
          }),
          execute: async ({ suspend, resumeData, inputData }) => {
            if (!resumeData) {
              return await suspend({ message: 'Please provide the age of the user' });
            }

            return {
              name: inputData?.name,
              email: 'test@test.com',
              age: resumeData?.age,
            };
          },
        });

        const findUserWorkflow = createWorkflow({
          id: 'find-user-workflow',
          description: 'This is a test tool that returns the name, and age',
          inputSchema: z.object({
            name: z.string(),
          }),
          outputSchema: z.object({
            name: z.string(),
            email: z.string(),
            age: z.number(),
          }),
        })
          .then(findUserStep)
          .commit();

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserWorkflow.',
          model: openaiModel,
          workflows: { findUserWorkflow },
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

        const output = await agentOne.generate('Find the user with name and age of - Dero Israel', {
          memory: {
            thread: 'test-thread',
            resource: 'test-resource',
          },
        });
        expect(output.finishReason).toBe('suspended');
        expect(output.toolResults).toHaveLength(0);
        expect(output.suspendPayload).toMatchObject({
          toolName: 'workflow-findUserWorkflow',
          suspendPayload: {
            message: 'Please provide the age of the user',
          },
        });
        const resumeOutput = await agentOne.generate('He is 25 years old', {
          memory: {
            thread: 'test-thread',
            resource: 'test-resource',
          },
        });

        const toolResults = resumeOutput.toolResults;

        const toolCall = toolResults?.find(
          (result: any) => result.payload.toolName === 'workflow-findUserWorkflow',
        )?.payload;

        const name = (toolCall?.result as any)?.result?.name;
        const email = (toolCall?.result as any)?.result?.email;
        const age = (toolCall?.result as any)?.result?.age;

        expect(resumeOutput.suspendPayload).toBeUndefined();
        expect(name).toBe('Dero Israel');
        expect(email).toBe('test@test.com');
        expect(age).toBe(25);
      }, 15000);
    });

    describe.skipIf(version === 'v1')('persist model output stream state', () => {
      it('should persist text stream state', async () => {
        const findUserTool = createTool({
          id: 'Find user tool',
          description: 'This is a test tool that returns the name and email',
          inputSchema: z.object({
            name: z.string(),
          }),
          execute: async input => {
            return mockFindUser(input) as Promise<Record<string, any>>;
          },
        });

        const userAgent = new Agent({
          id: 'user-agent',
          name: 'User Agent',
          instructions: 'You are an agent that can get list of users using findUserTool.',
          model: openaiModel,
          tools: { findUserTool },
        });

        const mastra = new Mastra({
          agents: { userAgent },
          logger: false,
          storage: mockStorage,
        });

        const agentOne = mastra.getAgent('userAgent');

        let toolCall;
        let response;
        if (version === 'v1') {
          response = await agentOne.generateLegacy('Find the user with name - Dero Israel', {
            maxSteps: 2,
            toolChoice: 'required',
          });
          toolCall = response.toolResults.find((result: any) => result.toolName === 'findUserTool');
        } else {
          const stream = await agentOne.stream(
            'First tell me about what tools you have. Then call the user tool to find the user with name - Dero Israel. Then tell me about what format you received the data and tell me what it would look like in human readable form.',
            {
              requireToolApproval: true,
            },
          );
          let firstText = '';
          let toolCallId = '';
          for await (const chunk of stream.fullStream) {
            if (chunk.type === 'text-delta') {
              firstText += chunk.payload.text;
            }
            if (chunk.type === 'tool-call-approval') {
              toolCallId = chunk.payload.toolCallId;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          const resumeStream = await agentOne.resumeStream({ approved: true }, { runId: stream.runId, toolCallId });
          let secondText = '';
          for await (const chunk of resumeStream.fullStream) {
            if (chunk.type === 'text-delta') {
              secondText += chunk.payload.text;
            }
          }

          const finalText = await resumeStream.text;

          const steps = await resumeStream.steps;
          const textBySteps = steps.map(step => step.text);

          expect(finalText).toBe(firstText + secondText);
          expect(steps.length).toBe(2);
          expect(textBySteps.join('')).toBe(firstText + secondText);
          const toolResults = await resumeStream.toolResults;
          toolCall = toolResults?.find((result: any) => result.payload.toolName === 'findUserTool')?.payload;
        }

        const name = toolCall?.result?.name;

        expect(mockFindUser).toHaveBeenCalled();
        expect(name).toBe('Dero Israel');
      }, 500000);
    });
  });
}

toolApprovalAndSuspensionTests('v2');
