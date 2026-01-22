import { isVercelTool } from '@mastra/core/tools';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
import { HTTPException } from '../http-exception';
import {
  executeToolContextBodySchema,
  executeToolResponseSchema,
  listToolsResponseSchema,
  serializedToolSchema,
  toolIdPathParams,
  agentToolPathParams,
  executeToolBodySchema,
} from '../schemas/agents';
import { optionalRunIdSchema } from '../schemas/common';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import { validateBody } from './utils';

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/tools',
  responseType: 'json',
  responseSchema: listToolsResponseSchema,
  summary: 'List all tools',
  description: 'Returns a list of all available tools in the system',
  tags: ['Tools'],
  handler: async ({ mastra, tools }) => {
    try {
      const allTools = tools || mastra.listTools() || {};

      const serializedTools = Object.entries(allTools).reduce(
        (acc, [id, _tool]) => {
          const tool = _tool;
          acc[id] = {
            ...tool,
            inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
            outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
          };
          return acc;
        },
        {} as Record<string, any>,
      );

      return serializedTools;
    } catch (error) {
      return handleError(error, 'Error getting tools');
    }
  },
});

export const GET_TOOL_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/tools/:toolId',
  responseType: 'json',
  pathParamSchema: toolIdPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get tool by ID',
  description: 'Returns details for a specific tool including its schema and configuration',
  tags: ['Tools'],
  handler: async ({ mastra, tools, toolId }) => {
    try {
      let tool: any;

      // Try explicit tools first, then fallback to mastra
      if (tools && Object.keys(tools).length > 0) {
        tool = Object.values(tools).find((t: any) => t.id === toolId);
      } else {
        tool = mastra.getToolById(toolId);
      }

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      const serializedTool = {
        ...tool,
        inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
        outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
      };

      return serializedTool;
    } catch (error) {
      return handleError(error, 'Error getting tool');
    }
  },
});

export const EXECUTE_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: toolIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: executeToolContextBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute tool',
  description: 'Executes a specific tool with the provided input data',
  tags: ['Tools'],
  handler: async ctx => {
    const { mastra, runId, toolId, tools, requestContext, ...bodyParams } = ctx as any;

    try {
      if (!toolId) {
        throw new HTTPException(400, { message: 'Tool ID is required' });
      }

      let tool: any;

      // Try explicit tools first, then fallback to mastra
      if (tools && Object.keys(tools).length > 0) {
        tool = Object.values(tools).find((t: any) => t.id === toolId);
      } else {
        tool = mastra.getToolById(toolId);
      }

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      if (!tool?.execute) {
        throw new HTTPException(400, { message: 'Tool is not executable' });
      }

      const { data } = bodyParams;

      validateBody({ data });

      let result;
      if (isVercelTool(tool)) {
        result = await (tool as any).execute(data);
      } else {
        result = await tool.execute(data!, {
          mastra,
          requestContext,
          // TODO: Pass proper tracing context when server API supports tracing
          tracingContext: { currentSpan: undefined },
          ...(runId
            ? {
                workflow: {
                  runId,
                  suspend: async () => {},
                },
              }
            : {}),
        });
      }

      return result;
    } catch (error) {
      return handleError(error, 'Error executing tool');
    }
  },
});

// ============================================================================
// Agent Tool Routes
// ============================================================================

export const GET_AGENT_TOOL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agents/:agentId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get agent tool',
  description: 'Returns details for a specific tool assigned to the agent',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, toolId, requestContext }) => {
    try {
      const agent = agentId ? mastra.getAgentById(agentId) : null;
      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      const agentTools = await agent.listTools({ requestContext });

      const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      const serializedTool = {
        ...tool,
        inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
        outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
      };

      return serializedTool;
    } catch (error) {
      return handleError(error, 'Error getting agent tool');
    }
  },
});

export const EXECUTE_AGENT_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  bodySchema: executeToolBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute agent tool',
  description: 'Executes a specific tool assigned to the agent with the provided input data',
  tags: ['Agents', 'Tools'],
  handler: async ctx => {
    const { mastra, agentId, toolId, data, requestContext } = ctx as any;

    try {
      const agent = agentId ? mastra.getAgentById(agentId) : null;
      if (!agent) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      const agentTools = await agent.listTools({ requestContext });

      const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      if (!tool?.execute) {
        throw new HTTPException(400, { message: 'Tool is not executable' });
      }

      const result = await tool.execute(data, {
        mastra,
        requestContext,
        // TODO: Pass proper tracing context when server API supports tracing
        tracingContext: { currentSpan: undefined },
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error executing agent tool');
    }
  },
});
