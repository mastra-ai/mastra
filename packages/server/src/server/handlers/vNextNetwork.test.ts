import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import type { Workflow } from '@mastra/core/workflows';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import {
  getVNextNetworksHandler,
  getVNextNetworkByIdHandler,
  generateVNextNetworkHandler,
  streamGenerateVNextNetworkHandler,
} from './vNextNetwork';

function createMockAgent1(name: string) {
  return new Agent({
    name,
    instructions: 'test agent',
    description: 'test agent',
    model: createMockModel({ mockText: 'Hello, world!' }),
  });
}

function createMockAgent2(name: string) {
  return new Agent({
    name,
    description: 'test agent',
    instructions: 'test agent',
    model: createMockModel({ mockText: 'Hello, world!' }),
  });
}

function createMockWorkflow(name: string) {
  const agentStep1 = createStep({
    id: 'agent-step',
    description: 'This step is used to do research',
    inputSchema: z.object({
      city: z.string().describe('The city to research'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      const resp = await createMockAgent1('agent1').generate(inputData.city, {
        output: z.object({
          text: z.string(),
        }),
      });

      return { text: resp.object.text };
    },
  });

  const agentStep2 = createStep({
    id: 'agent-step',
    description: 'This step is used to do text synthesis.',
    inputSchema: z.object({
      text: z.string().describe('The city to research'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      const resp = await createMockAgent2('agent2').generate(inputData.text, {
        output: z.object({
          text: z.string(),
        }),
      });

      return { text: resp.object.text };
    },
  });

  return createWorkflow({
    id: name,
    description: 'test workflow',
    steps: [],
    inputSchema: z.object({
      city: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
  })
    .then(agentStep1)
    .then(agentStep2)
    .commit();
}

function createMockNetwork(name: string, agents: Record<string, Agent> = {}, workflows: Record<string, Workflow> = {}) {
  return new NewAgentNetwork({
    id: name,
    name,
    instructions: 'test network',
    agents,
    workflows,
    model: createMockModel({ mockText: 'Hello, world!' }),
  });
}

describe('VNextNetwork Handlers', () => {
  let mockMastra: Mastra;
  let mockNetwork: NewAgentNetwork;
  let mockAgents: Record<string, Agent>;
  let mockWorkflows: Record<string, Workflow>;

  const runtimeContext = new RuntimeContext();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgents = { agent1: createMockAgent1('agent1'), agent2: createMockAgent2('agent2') };
    mockWorkflows = { workflow1: createMockWorkflow('workflow1') };
    mockNetwork = createMockNetwork('test-network', mockAgents, mockWorkflows);
    mockMastra = new Mastra({
      logger: false,
      vnext_networks: {
        'test-network': mockNetwork,
      },
    });
  });

  describe('getVNextNetworksHandler', () => {
    it('should get all networks successfully', async () => {
      const result = await getVNextNetworksHandler({ mastra: mockMastra, runtimeContext });

      const llm = await createMockAgent1('agent1').getLLM({ runtimeContext });

      expect(result).toEqual([
        {
          id: 'test-network',
          name: 'test-network',
          instructions: expect.any(String),
          agents: [
            { name: 'agent1', provider: llm.getProvider(), modelId: llm.getModelId() },
            { name: 'agent2', provider: llm.getProvider(), modelId: llm.getModelId() },
          ],
          workflows: [
            {
              name: 'workflow1',
              description: 'test workflow',
              inputSchema: expect.any(String),
              outputSchema: expect.any(String),
            },
          ],
          tools: [],
          routingModel: { provider: llm.getProvider(), modelId: llm.getModelId() },
        },
      ]);
    });
  });

  describe('getVNextNetworkByIdHandler', () => {
    it('should throw error when networkId is not provided', async () => {
      await expect(getVNextNetworkByIdHandler({ mastra: mockMastra, runtimeContext })).rejects.toThrow(
        'Network not found',
      );
    });

    it('should throw error when network is not found', async () => {
      await expect(
        getVNextNetworkByIdHandler({ mastra: mockMastra, runtimeContext, networkId: 'non-existent' }),
      ).rejects.toThrow('Network not found');
    });

    it('should get network by ID successfully', async () => {
      const result = await getVNextNetworkByIdHandler({
        mastra: mockMastra,
        runtimeContext,
        networkId: 'test-network',
      });

      const llm = await createMockAgent1('agent1').getLLM({ runtimeContext });

      expect(result).toEqual({
        id: 'test-network',
        name: 'test-network',
        instructions: expect.any(String),
        agents: [
          { name: 'agent1', provider: llm.getProvider(), modelId: llm.getModelId() },
          { name: 'agent2', provider: llm.getProvider(), modelId: llm.getModelId() },
        ],
        workflows: [
          {
            name: 'workflow1',
            description: 'test workflow',
            inputSchema: expect.any(String),
            outputSchema: expect.any(String),
          },
        ],
        tools: [],
        routingModel: { provider: llm.getProvider(), modelId: llm.getModelId() },
      });
    });
  });

  describe('generateVNextNetworkHandler', () => {
    it('should throw error when networkId is not provided', async () => {
      await expect(
        generateVNextNetworkHandler({
          mastra: mockMastra,
          body: {
            message: 'test message',
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when network is not found', async () => {
      await expect(
        generateVNextNetworkHandler({
          mastra: mockMastra,
          networkId: 'non-existent',
          body: {
            message: 'test message',
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when messages are not provided', async () => {
      await expect(
        generateVNextNetworkHandler({
          mastra: mockMastra,
          networkId: 'test-network',
          body: {
            message: '',
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "message" is required' }));
    });

    it('should generate successfully', async () => {
      const mockMessage = 'test message';
      const mockResult = { text: 'generated response' } as any;
      vi.spyOn(mockNetwork, 'generate').mockResolvedValue(mockResult);

      const result = await generateVNextNetworkHandler({
        mastra: mockMastra,
        networkId: 'test-network',
        body: {
          message: mockMessage,
        },
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('streamGenerateVNextNetworkHandler', () => {
    it('should throw error when networkId is not provided', async () => {
      await expect(
        streamGenerateVNextNetworkHandler({
          mastra: mockMastra,
          body: {
            message: 'test message',
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when network is not found', async () => {
      await expect(
        streamGenerateVNextNetworkHandler({
          mastra: mockMastra,
          networkId: 'non-existent',
          body: {
            message: 'test message',
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when messages are not provided', async () => {
      await expect(
        streamGenerateVNextNetworkHandler({
          mastra: mockMastra,
          networkId: 'test-network',
          body: {
            message: '',
          },
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "message" is required' }));
    });

    it('should stream generate successfully', async () => {
      const mockMessage = 'test message';
      const mockStreamResult = {
        [Symbol.asyncIterator]: async function* () {
          yield { text: 'streamed response' };
        },
      } as any;

      vi.spyOn(mockNetwork, 'stream').mockResolvedValue(mockStreamResult as any);

      const result = await streamGenerateVNextNetworkHandler({
        mastra: mockMastra,
        networkId: 'test-network',
        body: {
          message: mockMessage,
        },
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toEqual(mockStreamResult);
    });
  });
});
