import { openai } from '@ai-sdk/openai';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/di';
import { Mastra } from '@mastra/core/mastra';
import type { EvalRow, MastraStorage } from '@mastra/core/storage';
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
  streamGenerateHandler,
  updateAgentModelHandler,
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

  const runtimeContext = new RuntimeContext();

  beforeEach(() => {
    mockAgent = makeMockAgent();

    mockMastra = makeMastraMock({
      agents: {
        'test-agent': mockAgent,
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
          workflows: {},
          provider: 'openai.chat',
          modelId: 'gpt-4o',
          modelVersion: 'v1',
          defaultGenerateOptions: {},
          defaultStreamOptions: {},
        },
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
        provider: 'openai.chat',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        defaultGenerateOptions: {},
        defaultStreamOptions: {},
      });
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

      expect(result).toBeInstanceOf(Response);
    });

    it('should throw 404 when agent not found', async () => {
      await expect(
        streamGenerateHandler({
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
      const updateResult = updateAgentModelHandler({
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

      expect(result).toBeInstanceOf(Response);
    });
  });
});
