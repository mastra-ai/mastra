import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { AgentNetwork } from '@mastra/core/network';
import type { JSONSchema7 } from 'json-schema';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ZodType } from 'zod';
import { HTTPException } from '../http-exception';
import { getNetworksHandler, getNetworkByIdHandler, generateHandler, streamGenerateHandler } from './network';

interface NetworkContext {
  mastra: Mastra;
  networkId?: string;
  resourceId: string;
  threadId: string;
  messages?: string[];
  experimental_output?: JSONSchema7 | ZodType<any, any, any>;
}

function createMockAgent(name: string) {
  return new Agent({
    name,
    instructions: 'You are a helpful assistant',
    model: {
      provider: 'test-provider',
      modelId: 'test-model',
    } as any,
  });
}

function createMockNetwork(name: string, agents: Agent[] = []) {
  return new AgentNetwork({
    name,
    instructions: 'You are a helpful assistant',
    agents,
    model: {
      provider: 'test-provider',
      modelId: 'test-model',
    } as any,
  });
}

describe('Network Handlers', () => {
  let mockMastra: Mastra;
  let mockNetwork: AgentNetwork;
  let mockAgents: Agent[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgents = [createMockAgent('agent1'), createMockAgent('agent2')];
    mockNetwork = createMockNetwork('test-network', mockAgents);
    mockMastra = new Mastra({
      logger: false,
      networks: {
        'test-network': mockNetwork,
      },
    });
  });

  describe('getNetworksHandler', () => {
    it('should get all networks successfully', async () => {
      const result = await getNetworksHandler({ mastra: mockMastra });

      expect(result).toEqual([
        {
          id: 'test-network',
          name: 'test-network',
          instructions: expect.any(String),
          agents: [
            { name: 'agent1', provider: 'test-provider', modelId: 'test-model' },
            { name: 'agent2', provider: 'test-provider', modelId: 'test-model' },
          ],
          routingModel: { provider: 'test-provider', modelId: 'test-model' },
        },
      ]);
    });
  });

  describe('getNetworkByIdHandler', () => {
    it('should throw error when networkId is not provided', async () => {
      await expect(getNetworkByIdHandler({ mastra: mockMastra })).rejects.toThrow('Network not found');
    });

    it('should throw error when network is not found', async () => {
      await expect(getNetworkByIdHandler({ mastra: mockMastra, networkId: 'non-existent' })).rejects.toThrow(
        'Network not found',
      );
    });

    it('should get network by ID successfully', async () => {
      const result = await getNetworkByIdHandler({
        mastra: mockMastra,
        networkId: 'test-network',
      });

      expect(result).toEqual({
        id: 'test-network',
        name: 'test-network',
        instructions: expect.any(String),
        agents: [
          { name: 'agent1', provider: 'test-provider', modelId: 'test-model' },
          { name: 'agent2', provider: 'test-provider', modelId: 'test-model' },
        ],
        routingModel: { provider: 'test-provider', modelId: 'test-model' },
      });
    });
  });

  describe('generateHandler', () => {
    it('should throw error when networkId is not provided', async () => {
      await expect(
        generateHandler({
          mastra: mockMastra,
          messages: ['test message'],
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when network is not found', async () => {
      await expect(
        generateHandler({
          mastra: mockMastra,
          networkId: 'non-existent',
          messages: ['test message'],
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when messages are not provided', async () => {
      await expect(
        generateHandler({
          mastra: mockMastra,
          networkId: 'test-network',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "messages" is required' }));
    });

    it('should generate successfully', async () => {
      const mockMessages = ['test message'];
      const mockResult = { text: 'generated response' };
      vi.spyOn(mockNetwork, 'generate').mockResolvedValue(mockResult);

      const result = await generateHandler({
        mastra: mockMastra,
        networkId: 'test-network',
        messages: mockMessages,
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('streamGenerateHandler', () => {
    it('should throw error when networkId is not provided', async () => {
      await expect(
        streamGenerateHandler({
          mastra: mockMastra,
          messages: ['test message'],
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when network is not found', async () => {
      await expect(
        streamGenerateHandler({
          mastra: mockMastra,
          networkId: 'non-existent',
          messages: ['test message'],
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Network not found' }));
    });

    it('should throw error when messages are not provided', async () => {
      await expect(
        streamGenerateHandler({
          mastra: mockMastra,
          networkId: 'test-network',
        }),
      ).rejects.toThrow(new HTTPException(400, { message: 'Argument "messages" is required' }));
    });

    it('should stream generate successfully', async () => {
      const mockMessages = ['test message'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { text: 'streamed response' };
        },
      };
      vi.spyOn(mockNetwork, 'stream').mockResolvedValue(mockStream);

      const result = await streamGenerateHandler({
        mastra: mockMastra,
        networkId: 'test-network',
        messages: mockMessages,
      });

      expect(result).toEqual(mockStream);
    });
  });
});
