import { openai } from '@ai-sdk/openai';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { MastraStorage } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getAgentsHandler,
  getAgentByIdHandler,
  getEvalsByAgentIdHandler,
  getLiveEvalsByAgentIdHandler,
  generateHandler,
  streamGenerateHandler,
} from './agents';

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

describe('Agent Handlers', () => {
  let mockMastra: Mastra;
  let mockAgent: Agent;

  beforeEach(() => {
    mockAgent = new MockAgent({
      name: 'test-agent',
      instructions: 'test instructions',
      model: openai('gpt-4o'),
    });

    mockMastra = new Mastra({
      logger: false,
      agents: {
        'test-agent': mockAgent,
      },
      storage: {
        __setTelemetry: vi.fn(),
        __setLogger: vi.fn(),
        getEvalsByAgentName: vi.fn(),
      } as unknown as MastraStorage,
    });
  });

  describe('getAgentsHandler', () => {
    it('should return serialized agents', async () => {
      const result = await getAgentsHandler({ mastra: mockMastra });

      expect(result).toEqual({
        'test-agent': {
          name: 'test-agent',
          instructions: 'test instructions',
          tools: {},
          provider: 'openai.chat',
          modelId: 'gpt-4o',
        },
      });
    });
  });

  describe('getAgentByIdHandler', () => {
    it('should return serialized agent', async () => {
      const result = await getAgentByIdHandler({ mastra: mockMastra, agentId: 'test-agent' });

      expect(result).toEqual({
        name: 'test-agent',
        instructions: 'test instructions',
        tools: {},
        provider: 'openai.chat',
        modelId: 'gpt-4o',
      });
    });

    it('should throw 404 when agent not found', async () => {
      await expect(getAgentByIdHandler({ mastra: mockMastra, agentId: 'non-existing' })).rejects.toThrow(
        new HTTPException(404, {
          message: 'Agent with name non-existing not found',
        }),
      );
    });
  });

  describe('getEvalsByAgentIdHandler', () => {
    it('should return agent evals', async () => {
      const mockEvals = [{ id: 1, data: 'test' }];
      vi.spyOn(mockMastra.getStorage(), 'getEvalsByAgentName').mockResolvedValue(mockEvals);

      const result = await getEvalsByAgentIdHandler({ mastra: mockMastra, agentId: 'test-agent' });

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
      const mockEvals = [{ id: 1, data: 'test' }];
      vi.spyOn(mockMastra.getStorage(), 'getEvalsByAgentName').mockResolvedValue(mockEvals);

      const result = await getLiveEvalsByAgentIdHandler({ mastra: mockMastra, agentId: 'test-agent' });

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
        },
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
          },
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
        },
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
          },
        }),
      ).rejects.toThrow(new HTTPException(404, { message: 'Agent with name non-existing not found' }));
    });
  });
});
