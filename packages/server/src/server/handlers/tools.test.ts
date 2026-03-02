import { openai } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import type { ToolAction, VercelTool } from '@mastra/core/tools';
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import { createTestServerContext } from './test-utils';
import {
  LIST_TOOLS_ROUTE,
  GET_TOOL_BY_ID_ROUTE,
  EXECUTE_TOOL_ROUTE,
  EXECUTE_AGENT_TOOL_ROUTE,
  GET_AGENT_TOOL_ROUTE,
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

  describe('listToolsHandler', () => {
    it('should return empty object when no tools are provided', async () => {
      const mastra = new Mastra({ logger: false });
      const result = await LIST_TOOLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        registeredTools: undefined,
      });
      expect(result).toEqual({});
    });

    it('should return serialized tools when tools are provided', async () => {
      const mastra = new Mastra({ logger: false });
      const result = await LIST_TOOLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        registeredTools: mockTools,
      });
      expect(result).toHaveProperty(mockTool.id);
      // expect(result).toHaveProperty(mockVercelTool.id);
      expect(result[mockTool.id]).toHaveProperty('id', mockTool.id);
      // expect(result[mockVercelTool.id]).toHaveProperty('id', mockVercelTool.id);
    });

    it('should fall back to mastra.listTools() when registeredTools is empty object', async () => {
      const mastra = new Mastra({
        logger: false,
        tools: mockTools,
      });
      // This mirrors what happens in the real server adapters (hono/express):
      // they set registeredTools to `this.tools || {}`, so when no tools are
      // passed to the server constructor, registeredTools becomes {}
      const result = await LIST_TOOLS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        registeredTools: {},
      });
      expect(result).toHaveProperty(mockTool.id);
      expect(result[mockTool.id]).toHaveProperty('id', mockTool.id);
    });
  });

  describe('getToolByIdHandler', () => {
    it('should throw 404 when tool is not found', async () => {
      const mastra = new Mastra({ logger: false });
      await expect(
        GET_TOOL_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          registeredTools: mockTools,
          toolId: 'non-existent',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should return serialized tool when found', async () => {
      const mastra = new Mastra({ logger: false });
      const result = await GET_TOOL_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        registeredTools: mockTools,
        toolId: mockTool.id,
      });
      expect(result).toHaveProperty('id', mockTool.id);
      expect(result).toHaveProperty('description', mockTool.description);
    });
  });

  describe('executeToolHandler', () => {
    it('should throw error when toolId is not provided', async () => {
      await expect(
        EXECUTE_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra({ logger: false }) }),
          registeredTools: mockTools,
          toolId: undefined as any,
          data: {},
        }),
      ).rejects.toThrow('Tool ID is required');
    });

    it('should throw 404 when tool is not found', async () => {
      await expect(
        EXECUTE_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra({ logger: false }) }),
          registeredTools: mockTools,
          toolId: 'non-existent',
          data: {},
        }),
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error when tool is not executable', async () => {
      const nonExecutableTool = { ...mockTool, execute: undefined };
      const registeredTools = { [nonExecutableTool.id]: nonExecutableTool };

      await expect(
        EXECUTE_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra() }),
          registeredTools,
          toolId: nonExecutableTool.id,
          data: {},
        }),
      ).rejects.toThrow('Tool is not executable');
    });

    it('should throw error when data is not provided', async () => {
      await expect(
        EXECUTE_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra() }),
          registeredTools: mockTools,
          toolId: mockTool.id,
          data: null as any,
        }),
      ).rejects.toThrow('Argument "data" is required');
    });

    it('should execute regular tool successfully', async () => {
      const mockResult = { success: true };
      const mockMastra = new Mastra();
      mockExecute.mockResolvedValue(mockResult);
      const context = { test: 'data' };

      const result = await EXECUTE_TOOL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        registeredTools: mockTools,
        toolId: mockTool.id,
        runId: 'test-run',
        data: context,
      });

      expect(result).toEqual(mockResult);
      expect(mockExecute).toHaveBeenCalledWith(context, {
        mastra: mockMastra,
        requestContext: expect.any(RequestContext),
        tracingContext: {
          currentSpan: undefined,
        },
        workflow: {
          runId: 'test-run',
          suspend: expect.any(Function),
        },
      });
    });

    it.skip('should execute Vercel tool successfully', async () => {
      const mockMastra = new Mastra();
      const mockResult = { success: true };
      (mockVercelTool.execute as Mock<() => any>).mockResolvedValue(mockResult);

      const result = await EXECUTE_TOOL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        registeredTools: mockTools,
        toolId: `tool`,
        data: { test: 'data' },
      });

      expect(result).toEqual(mockResult);
      expect(mockVercelTool.execute).toHaveBeenCalledWith({ test: 'data' });
    });
  });

  describe('executeAgentToolHandler', () => {
    const mockAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant',
      tools: mockTools,
      model: 'gpt-4o' as any,
    });

    it('should throw 404 when agent is not found', async () => {
      await expect(
        EXECUTE_AGENT_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra({ logger: false }) }),
          agentId: 'non-existent',
          toolId: mockTool.id,
          data: {},
        }),
      ).rejects.toThrow('Agent with id non-existent not found');
    });

    it('should throw 404 when tool is not found in agent', async () => {
      await expect(
        EXECUTE_AGENT_TOOL_ROUTE.handler({
          ...createTestServerContext({
            mastra: new Mastra({
              logger: false,
              agents: { 'test-agent': mockAgent as any },
            }),
          }),
          agentId: 'test-agent',
          toolId: 'non-existent',
          data: {},
        }),
      ).rejects.toThrow('Tool not found');
    });

    it('should throw error when tool is not executable', async () => {
      const nonExecutableTool = { ...mockTool, execute: undefined };
      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: `You're a helpful assistant`,
        tools: { [nonExecutableTool.id]: nonExecutableTool },
        model: 'gpt-4o' as any,
      });

      await expect(
        EXECUTE_AGENT_TOOL_ROUTE.handler({
          ...createTestServerContext({
            mastra: new Mastra({
              logger: false,
              agents: { 'test-agent': agent as any },
            }),
          }),
          agentId: 'test-agent',
          toolId: nonExecutableTool.id,
          data: {},
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
      const result = await EXECUTE_AGENT_TOOL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
        toolId: mockTool.id,
        data: context,
      });

      expect(result).toEqual(mockResult);
      expect(mockExecute).toHaveBeenCalledWith(context, {
        mastra: mockMastra,
        requestContext: expect.any(RequestContext),
        tracingContext: {
          currentSpan: undefined,
        },
      });
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

      const result = await EXECUTE_AGENT_TOOL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        agentId: 'test-agent',
        toolId: `tool`,
        data: {},
      });

      expect(result).toEqual(mockResult);
      expect(mockVercelTool.execute).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getAgentToolHandler', () => {
    const mockAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant',
      tools: mockTools,
      model: 'gpt-4o' as any,
    });

    it('should throw 404 when agent is not found', async () => {
      await expect(
        GET_AGENT_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: new Mastra({ logger: false }) }),
          agentId: 'non-existent',
          toolId: mockTool.id,
        }),
      ).rejects.toThrow(
        new HTTPException(404, {
          message: 'Agent with id non-existent not found',
        }),
      );
    });

    it('should throw 404 when tool is not found in agent', async () => {
      await expect(
        GET_AGENT_TOOL_ROUTE.handler({
          ...createTestServerContext({
            mastra: new Mastra({
              logger: false,
              agents: { 'test-agent': mockAgent as any },
            }),
          }),
          agentId: 'test-agent',
          toolId: 'non-existent',
        }),
      ).rejects.toThrow(
        new HTTPException(404, {
          message: 'Tool not found',
        }),
      );
    });

    it('should return serialized tool when found', async () => {
      const result = await GET_AGENT_TOOL_ROUTE.handler({
        ...createTestServerContext({
          mastra: new Mastra({
            logger: false,
            agents: { 'test-agent': mockAgent as any },
          }),
        }),
        agentId: 'test-agent',
        toolId: mockTool.id,
      });
      expect(result).toHaveProperty('id', mockTool.id);
      expect(result).toHaveProperty('description', mockTool.description);
    });
  });

  describe('provider-defined tools serialization', () => {
    const providerTool = openai.tools.webSearch({});

    const providerTools = {
      web_search: providerTool,
    };

    const mixedTools = {
      [mockTool.id]: mockTool,
      web_search: providerTool,
    };

    describe('listToolsHandler', () => {
      it('should serialize provider-defined tools without crashing', async () => {
        const mastra = new Mastra({ logger: false });
        const result = await LIST_TOOLS_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          registeredTools: providerTools as any,
        });
        expect(result).toHaveProperty('web_search');
        expect(result['web_search']).toHaveProperty('type', 'provider-defined');
        // Verify the lazy inputSchema was actually resolved and serialized
        expect(result['web_search'].inputSchema).toBeDefined();
      });

      it('should serialize a mix of regular and provider-defined tools', async () => {
        const mastra = new Mastra({ logger: false });
        const result = await LIST_TOOLS_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          registeredTools: mixedTools as any,
        });
        expect(result).toHaveProperty(mockTool.id);
        expect(result).toHaveProperty('web_search');
        expect(result[mockTool.id]).toHaveProperty('id', mockTool.id);
        expect(result['web_search']).toHaveProperty('type', 'provider-defined');
      });
    });

    describe('getToolByIdHandler', () => {
      it('should serialize a provider-defined tool without crashing', async () => {
        const mastra = new Mastra({ logger: false });
        const result = await GET_TOOL_BY_ID_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          registeredTools: providerTools as any,
          toolId: 'openai.web_search',
        });
        expect(result).toHaveProperty('type', 'provider-defined');
        expect(result).toHaveProperty('id', 'openai.web_search');
      });
    });

    describe('getAgentToolHandler', () => {
      it('should serialize a provider-defined agent tool without crashing', async () => {
        const agent = new Agent({
          id: 'provider-tool-agent',
          name: 'provider-tool-agent',
          instructions: 'You are a search assistant',
          tools: providerTools as any,
          model: 'openai/gpt-4o-mini' as any,
        });

        const result = await GET_AGENT_TOOL_ROUTE.handler({
          ...createTestServerContext({
            mastra: new Mastra({
              logger: false,
              agents: { 'provider-tool-agent': agent as any },
            }),
          }),
          agentId: 'provider-tool-agent',
          toolId: 'openai.web_search',
        });
        expect(result).toHaveProperty('type', 'provider-defined');
        expect(result).toHaveProperty('id', 'openai.web_search');
      });
    });
  });
});
