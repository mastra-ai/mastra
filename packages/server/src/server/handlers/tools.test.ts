import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createTool } from '@mastra/core/tools';
import type { ToolAction, VercelTool } from '@mastra/core/tools';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  getToolsHandler,
  getToolByIdHandler,
  executeToolHandler,
  executeAgentToolHandler,
  getAgentToolHandler,
} from './tools';

describe('Tools Handlers', () => {
  const mockExecute = vi.fn();
  const mockTool: ToolAction = createTool({
    id: 'test-tool',
    description: 'A test tool',
    execute: mockExecute,
  });

  const mockVercelTool: VercelTool = {
    description: 'A Vercel tool',
    parameters: {},
    execute: vi.fn(),
  };

  const mockTools = {
    [mockTool.id]: mockTool,
    // [mockVercelTool.id]: mockVercelTool,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getToolsHandler', () => {
    it('should return empty object when no tools are provided', async () => {
      const result = await getToolsHandler({ tools: undefined });
      expect(result).toEqual({});
    });

    it('should return serialized tools when tools are provided', async () => {
      const result = await getToolsHandler({ tools: mockTools });
      expect(result).toHaveProperty(mockTool.id);
      // expect(result).toHaveProperty(mockVercelTool.id);
      expect(result[mockTool.id]).toHaveProperty('id', mockTool.id);
      // expect(result[mockVercelTool.id]).toHaveProperty('id', mockVercelTool.id);
    });
  });

  describe('getToolByIdHandler', () => {
    it('should throw 404 when tool is not found', async () => {
      await expect(getToolByIdHandler({ tools: mockTools, toolId: 'non-existent' })).rejects.toThrow(HTTPException);
    });

    it('should return serialized tool when found', async () => {
      const result = await getToolByIdHandler({ tools: mockTools, toolId: mockTool.id });
      expect(result).toHaveProperty('id', mockTool.id);
      expect(result).toHaveProperty('description', mockTool.description);
    });
  });

  describe('executeToolHandler', () => {
    const executeTool = executeToolHandler(mockTools);

    it('should throw error when toolId is not provided', async () => {
      await expect(
        executeTool({
          mastra: new Mastra({ logger: false }),
          data: {},
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Tool ID is required');
    });

    it('should throw 404 when tool is not found', async () => {
      await expect(
        executeTool({
          mastra: new Mastra({ logger: false }),
          toolId: 'non-existent',
          data: {},
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error when tool is not executable', async () => {
      const nonExecutableTool = { ...mockTool, execute: undefined };
      const tools = { [nonExecutableTool.id]: nonExecutableTool };
      const executeTool = executeToolHandler(tools);

      await expect(
        executeTool({
          mastra: new Mastra(),
          toolId: nonExecutableTool.id,
          data: {},
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Tool is not executable');
    });

    it('should throw error when data is not provided', async () => {
      await expect(
        executeTool({
          mastra: new Mastra(),
          toolId: mockTool.id,
          data: null,
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Argument "data" is required');
    });

    it('should execute regular tool successfully', async () => {
      const mockResult = { success: true };
      const mockMastra = new Mastra();
      const executeTool = executeToolHandler(mockTools);
      mockExecute.mockResolvedValue(mockResult);
      const context = { test: 'data' };

      const runtimeContext = new RuntimeContext();
      const result = await executeTool({
        mastra: mockMastra,
        toolId: mockTool.id,
        runId: 'test-run',
        runtimeContext: runtimeContext,
        data: context,
      });

      expect(result).toEqual(mockResult);
      expect(mockExecute).toHaveBeenCalledWith(
        {
          context,
          mastra: mockMastra,
          runId: 'test-run',
          runtimeContext: runtimeContext,
          tracingContext: {
            currentSpan: undefined,
          },
        },
        undefined,
      );
    });

    it.skip('should execute Vercel tool successfully', async () => {
      const mockMastra = new Mastra();
      const mockResult = { success: true };
      (mockVercelTool.execute as Mock<() => any>).mockResolvedValue(mockResult);

      const result = await executeTool({
        mastra: mockMastra,
        toolId: `tool`,
        runtimeContext: new RuntimeContext(),
        data: { test: 'data' },
      });

      expect(result).toEqual(mockResult);
      expect(mockVercelTool.execute).toHaveBeenCalledWith({ test: 'data' });
    });
  });

  describe('executeAgentToolHandler', () => {
    const mockAgent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant',
      tools: mockTools,
      model: 'gpt-4o' as any,
    });

    it('should throw 404 when agent is not found', async () => {
      await expect(
        executeAgentToolHandler({
          mastra: new Mastra({ logger: false }),
          agentId: 'non-existent',
          toolId: mockTool.id,
          data: {},
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Agent with name non-existent not found');
    });

    it('should throw 404 when tool is not found in agent', async () => {
      await expect(
        executeAgentToolHandler({
          mastra: new Mastra({
            logger: false,
            agents: { 'test-agent': mockAgent as any },
          }),
          agentId: 'test-agent',
          toolId: 'non-existent',
          data: {},
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error when tool is not executable', async () => {
      const nonExecutableTool = { ...mockTool, execute: undefined };
      const agent = new Agent({
        name: 'test-agent',
        instructions: `You're a helpful assistant`,
        tools: { [nonExecutableTool.id]: nonExecutableTool },
        model: 'gpt-4o' as any,
      });

      await expect(
        executeAgentToolHandler({
          mastra: new Mastra({
            logger: false,
            agents: { 'test-agent': agent as any },
          }),
          agentId: 'test-agent',
          toolId: nonExecutableTool.id,
          data: {},
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow('Tool is not executable');
    });

    it('should execute regular tool successfully', async () => {
      const mockResult = { success: true };
      const mockMastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent as any,
        },
      });
      mockExecute.mockResolvedValue(mockResult);

      const context = {
        test: 'data',
      };
      const runtimeContext = new RuntimeContext();
      const result = await executeAgentToolHandler({
        mastra: mockMastra,
        agentId: 'test-agent',
        toolId: mockTool.id,
        data: context,
        runtimeContext: runtimeContext,
      });

      expect(result).toEqual(mockResult);
      expect(mockExecute).toHaveBeenCalledWith(
        {
          context,
          mastra: mockMastra,
          runId: 'test-agent',
          runtimeContext: runtimeContext,
          tracingContext: {
            currentSpan: undefined,
          },
        },
        undefined,
      );
    });

    it.skip('should execute Vercel tool successfully', async () => {
      const mockResult = { success: true };
      (mockVercelTool.execute as Mock<() => any>).mockResolvedValue(mockResult);
      const mockMastra = new Mastra({
        logger: false,
        agents: {
          'test-agent': mockAgent as any,
        },
      });

      const result = await executeAgentToolHandler({
        mastra: mockMastra,
        agentId: 'test-agent',
        toolId: `tool`,
        data: {},
        runtimeContext: new RuntimeContext(),
      });

      expect(result).toEqual(mockResult);
      expect(mockVercelTool.execute).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getAgentToolHandler', () => {
    const mockAgent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful assistant',
      tools: mockTools,
      model: 'gpt-4o' as any,
    });

    it('should throw 404 when agent is not found', async () => {
      await expect(
        getAgentToolHandler({
          mastra: new Mastra({ logger: false }),
          agentId: 'non-existent',
          toolId: mockTool.id,
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(
        new HTTPException(404, {
          message: 'Agent with name non-existent not found',
        }),
      );
    });

    it('should throw 404 when tool is not found in agent', async () => {
      await expect(
        getAgentToolHandler({
          mastra: new Mastra({
            logger: false,
            agents: { 'test-agent': mockAgent as any },
          }),
          agentId: 'test-agent',
          toolId: 'non-existent',
          runtimeContext: new RuntimeContext(),
        }),
      ).rejects.toThrow(
        new HTTPException(404, {
          message: 'Tool not found',
        }),
      );
    });

    it('should return serialized tool when found', async () => {
      const result = await getAgentToolHandler({
        mastra: new Mastra({
          logger: false,
          agents: { 'test-agent': mockAgent as any },
        }),
        agentId: 'test-agent',
        toolId: mockTool.id,
        runtimeContext: new RuntimeContext(),
      });
      expect(result).toHaveProperty('id', mockTool.id);
      expect(result).toHaveProperty('description', mockTool.description);
    });
  });
});
