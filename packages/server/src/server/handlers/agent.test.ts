import { openai } from '@ai-sdk/openai';
import { openai as openaiV5 } from '@ai-sdk/openai-v5';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/di';
import { Mastra } from '@mastra/core/mastra';
import { UnicodeNormalizer, TokenLimiterProcessor } from '@mastra/core/processors';
import type { EvalRow, MastraStorage } from '@mastra/core/storage';
import type { AISDKV5OutputStream } from '@mastra/core/stream';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import {
  getAgentsHandler,
  getAgentByIdHandler,
  getEvalsByAgentIdHandler,
  getLiveEvalsByAgentIdHandler,
  generateHandler,
  updateAgentModelHandler,
  reorderAgentModelListHandler,
  updateAgentModelInModelListHandler,
  streamGenerateLegacyHandler,
  streamGenerateHandler,
} from './agents';

const mockEvals = [
  {
    runId: '1',
    input: 'test',
    output: 'test',
    result: {
      score: 1,
      info: {},
    },
    agentName: 'test-agent',
    createdAt: new Date().toISOString(),
    metricName: 'test',
    instructions: 'test',
    globalRunId: 'test',
  },
] as EvalRow[];
class MockAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);

    this.generate = vi.fn();
    this.stream = vi.fn();
    this.__updateInstructions = vi.fn();
  }

  generate(args: any) {
    return this.generate(args);
  }

  stream(args: any) {
    return this.stream(args);
  }

  __updateInstructions(args: any) {
    return this.__updateInstructions(args);
  }
}

const makeMockAgent = (config?: Partial<AgentConfig>) =>
  new MockAgent({
    name: 'test-agent',
    instructions: 'test instructions',
    model: openai('gpt-4o'),
    ...(config || {}),
  });

const makeMastraMock = ({ agents }: { agents: Record<string, ReturnType<typeof makeMockAgent>> }) =>
  new Mastra({
    logger: false,
    agents,
    storage: {
      init: vi.fn(),
      __setTelemetry: vi.fn(),
      __setLogger: vi.fn(),
      getEvalsByAgentName: vi.fn(),
      getStorage: () => {
        return {
          getEvalsByAgentName: vi.fn(),
        };
      },
    } as unknown as MastraStorage,
  });

describe('Agent Handlers', () => {
  let mockMastra: Mastra;
  let mockAgent: Agent;
  let mockMultiModelAgent: Agent;
  const runtimeContext = new RuntimeContext();

  beforeEach(() => {
    mockAgent = makeMockAgent();

    mockMultiModelAgent = makeMockAgent({
      name: 'test-multi-model-agent',
      model: [{ model: openaiV5('gpt-4o-mini') }, { model: openaiV5('gpt-4o') }, { model: openaiV5('gpt-4.1') }],
    });

    mockMastra = makeMastraMock({
      agents: {
        'test-agent': mockAgent,
        'test-multi-model-agent': mockMultiModelAgent,
      },
    });
  });

  describe('getAgentsHandler', () => {
    it('should return serialized agents', async () => {
      const result = await getAgentsHandler({ mastra: mockMastra, runtimeContext });

      expect(result).toEqual({
        'test-agent': {
          name: 'test-agent',
          instructions: 'test instructions',
          tools: {},
          agents: {},
          workflows: {},
          inputProcessors: [],
          outputProcessors: [],
          provider: 'openai.chat',
          modelId: 'gpt-4o',
          modelVersion: 'v1',
          defaultGenerateOptions: {},
          defaultStreamOptions: {},
          modelList: undefined,
        },
        'test-multi-model-agent': {
          name: 'test-multi-model-agent',
          instructions: 'test instructions',
          tools: {},
          agents: {},
          workflows: {},
          inputProcessors: [],
          outputProcessors: [],
          provider: 'openai.responses',
          modelId: 'gpt-4o-mini',
          modelVersion: 'v2',
          defaultGenerateOptions: {},
          defaultStreamOptions: {},
          modelList: [
            {
              id: expect.any(String),
              enabled: true,
              maxRetries: 0,
              model: { modelId: 'gpt-4o-mini', provider: 'openai.responses', modelVersion: 'v2' },
            },
            {
              id: expect.any(String),
              enabled: true,
              maxRetries: 0,
              model: { modelId: 'gpt-4o', provider: 'openai.responses', modelVersion: 'v2' },
            },
            {
              id: expect.any(String),
              enabled: true,
              maxRetries: 0,
              model: { modelId: 'gpt-4.1', provider: 'openai.responses', modelVersion: 'v2' },
            },
          ],
        },
      });
    });

    it('should return agents with serialized processors', async () => {
      const unicodeNormalizer = new UnicodeNormalizer();
      const tokenLimiter = new TokenLimiterProcessor({ limit: 1000 });

      const agentWithCoreProcessors = makeMockAgent({
        name: 'agent-with-core-processors',
        inputProcessors: [unicodeNormalizer],
        outputProcessors: [tokenLimiter],
      });

      const mastraWithCoreProcessors = makeMastraMock({
        agents: {
          'agent-with-core-processors': agentWithCoreProcessors,
        },
      });

      const result = await getAgentsHandler({ mastra: mastraWithCoreProcessors, runtimeContext });

      expect(result['agent-with-core-processors']).toMatchObject({
        name: 'agent-with-core-processors',
        inputProcessors: [
          {
            name: 'unicode-normalizer',
          },
        ],
        outputProcessors: [
          {
            name: 'token-limiter',
          },
        ],
      });
    });
  });

  describe('getAgentByIdHandler', () => {
    it('should return serialized agent', async () => {
      const firstStep = createStep({
        id: 'first',
        description: 'First step',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({}),
        execute: async () => ({}),
      });

      const secondStep = createStep({
        id: 'second',
        description: 'Second step',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async () => ({ greeting: 'Hello, world!' }),
      });

      const workflow = createWorkflow({
        id: 'hello-world',
        description: 'A simple hello world workflow with two steps',
        inputSchema: z.object({
          name: z.string(),
        }),
        outputSchema: z.object({
          greeting: z.string(),
        }),
      });

      workflow.then(firstStep).then(secondStep);
      mockAgent = makeMockAgent({ workflows: { hello: workflow } });
      mockMastra = makeMastraMock({ agents: { 'test-agent': mockAgent } });
      const result = await getAgentByIdHandler({ mastra: mockMastra, agentId: 'test-agent', runtimeContext });

      expect(result).toEqual({
        name: 'test-agent',
        instructions: 'test instructions',
        tools: {},
        agents: {},
        workflows: {
          hello: {
            name: 'hello-world',
            steps: {
              first: {
                id: 'first',
                description: 'First step',
              },
              second: {
                id: 'second',
                description: 'Second step',
              },
            },
          },
        },
        inputProcessors: [],
        outputProcessors: [],
        provider: 'openai.chat',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        defaultGenerateOptions: {},
        defaultStreamOptions: {},
        modelList: undefined,
      });
    });

    it('should return serialized agent with model list', async () => {
      const result = await getAgentByIdHandler({
        mastra: mockMastra,
        agentId: 'test-multi-model-agent',
        runtimeContext,
      });
      if (!result) {
        expect.fail('Result should be defined');
      }
      expect(result.modelList).toMatchObject([
        {
          id: expect.any(String),
          enabled: true,
          maxRetries: 0,
          model: { modelId: 'gpt-4o-mini', provider: 'openai.responses', modelVersion: 'v2' },
        },
        {
          id: expect.any(String),
          enabled: true,
          maxRetries: 0,
          model: { modelId: 'gpt-4o', provider: 'openai.responses', modelVersion: 'v2' },
        },
        {
          id: expect.any(String),
          enabled: true,
          maxRetries: 0,
          model: { modelId: 'gpt-4.1', provider: 'openai.responses', modelVersion: 'v2' },
        },
      ]);
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        getAgentByIdHandler({ mastra: mockMastra, runtimeContext, agentId: 'non-existing' }),
      ).rejects.toThrow(
        new HTTPException(404, {
          message: 'Agent with name non-existing not found',
        }),
      );
    });
  });

  describe('getEvalsByAgentIdHandler', () => {
    it('should return agent evals', async () => {
      const storage = mockMastra.getStorage();
      vi.spyOn(storage!, 'getEvalsByAgentName').mockResolvedValue(mockEvals);

      const result = await getEvalsByAgentIdHandler({ mastra: mockMastra, agentId: 'test-agent', runtimeContext });

      expect(result).toEqual({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        evals: mockEvals,
      });
    });
  });

  describe('getLiveEvalsByAgentIdHandler', () => {
    it('should return live agent evals', async () => {
      vi.spyOn(mockMastra.getStorage()!, 'getEvalsByAgentName').mockResolvedValue(mockEvals);

      const result = await getLiveEvalsByAgentIdHandler({ mastra: mockMastra, agentId: 'test-agent', runtimeContext });

      expect(result).toEqual({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        evals: mockEvals,
      });
    });
  });

  describe('generateHandler', () => {
    it('should generate response from agent', async () => {
      const mockResult = { response: 'test' };
      (mockAgent.generate as any).mockResolvedValue(mockResult);

      const result = await generateHandler({
        mastra: mockMastra,
        agentId: 'test-agent',
        body: {
          messages: ['test message'],
          resourceId: 'test-resource',
          threadId: 'test-thread',
          experimental_output: undefined,
          // @ts-expect-error
          runtimeContext: {
            user: {
              name: 'test-user',
            },
          },
        },
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toEqual(mockResult);
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        generateHandler({
          mastra: mockMastra,
          agentId: 'non-existing',
          body: {
            messages: ['test message'],
            resourceId: 'test-resource',
            threadId: 'test-thread',
            experimental_output: undefined,
            // @ts-expect-error
            runtimeContext: {
              user: {
                name: 'test-user',
              },
            },
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Agent with name non-existing not found' }));
    });
  });

  describe('streamGenerateHandler', () => {
    it('should stream response from agent', async () => {
      const mockStreamResult = {
        toTextStreamResponse: vi.fn().mockReturnValue(new Response()),
        toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
      };
      (mockAgent.stream as any).mockResolvedValue(mockStreamResult);

      const result = await streamGenerateLegacyHandler({
        mastra: mockMastra,
        agentId: 'test-agent',
        body: {
          messages: ['test message'],
          resourceId: 'test-resource',
          threadId: 'test-thread',
          experimental_output: undefined,
          // @ts-expect-error
          runtimeContext: {
            user: {
              name: 'test-user',
            },
          },
        },
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toBeInstanceOf(Response);
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        streamGenerateLegacyHandler({
          mastra: mockMastra,
          agentId: 'non-existing',
          body: {
            messages: ['test message'],
            resourceId: 'test-resource',
            threadId: 'test-thread',
            experimental_output: undefined,
            // @ts-expect-error
            runtimeContext: {
              user: {
                name: 'test-user',
              },
            },
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Agent with name non-existing not found' }));
    });
  });

  describe('updateAgentModelHandler', () => {
    it('should update agent model', async () => {
      const mockStreamResult = {
        toTextStreamResponse: vi.fn().mockReturnValue(new Response()),
        toDataStreamResponse: vi.fn().mockReturnValue(new Response()),
      };
      (mockAgent.stream as any).mockResolvedValue(mockStreamResult);
      const updateResult = await updateAgentModelHandler({
        mastra: mockMastra,
        agentId: 'test-agent',
        body: {
          modelId: 'gpt-4o-mini',
          provider: 'openai',
        },
      });

      const agent = mockMastra.getAgent('test-agent');
      const llm = await agent.getLLM();
      const modelId = llm.getModelId();
      expect(updateResult).toEqual({ message: 'Agent model updated' });
      expect(modelId).toEqual('gpt-4o-mini');
      //confirm that stream works fine after the model update

      const result = await streamGenerateHandler({
        mastra: mockMastra,
        agentId: 'test-agent',
        body: {
          messages: ['test message'],
          resourceId: 'test-resource',
          threadId: 'test-thread',
          experimental_output: undefined,
          // @ts-expect-error
          runtimeContext: {
            user: {
              name: 'test-user',
            },
          },
        },
        runtimeContext: new RuntimeContext(),
      });

      expect((result as AISDKV5OutputStream<any>).toTextStreamResponse()).toBeInstanceOf(Response);
    });
  });

  describe('reorderAgentModelListHandler', () => {
    it('should reorder list of models for agent', async () => {
      const agent = mockMastra.getAgent('test-multi-model-agent');
      const modelList = await agent.getModelList();

      if (!modelList) {
        expect.fail('Model list should be defined');
      }

      const modelListIds = modelList.map(m => m.id);
      const reversedModelListIds = modelListIds.reverse();

      await reorderAgentModelListHandler({
        mastra: mockMastra,
        agentId: 'test-multi-model-agent',
        body: {
          reorderedModelIds: reversedModelListIds,
        },
      });

      const reorderedModelList = await agent.getModelList();
      expect(reorderedModelList?.length).toBe(3);
      expect(reorderedModelList?.[0].model.modelId).toBe('gpt-4.1');
      expect(reorderedModelList?.[1].model.modelId).toBe('gpt-4o');
      expect(reorderedModelList?.[2].model.modelId).toBe('gpt-4o-mini');
    });
  });

  describe('updateAgentModelInModelListHandler', () => {
    it('should update a model in the model list', async () => {
      const agent = mockMastra.getAgent('test-multi-model-agent');
      const modelList = await agent.getModelList();
      expect(modelList?.length).toBe(3);
      const model1Id = modelList?.[1].id!;
      await updateAgentModelInModelListHandler({
        mastra: mockMastra,
        agentId: 'test-multi-model-agent',
        modelConfigId: model1Id,
        body: {
          model: {
            modelId: 'gpt-5',
            provider: 'openai',
          },
          maxRetries: 4,
        },
      });
      const updatedModelList = await agent.getModelList();
      expect(updatedModelList?.[0].model.modelId).toBe('gpt-4o-mini');
      expect(updatedModelList?.[1].model.modelId).toBe('gpt-5');
      expect(updatedModelList?.[1].maxRetries).toBe(4);
      expect(updatedModelList?.[2].model.modelId).toBe('gpt-4.1');
    });
  });
});
