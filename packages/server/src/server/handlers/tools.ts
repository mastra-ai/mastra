import { isVercelTool, isProviderDefinedTool } from '@mastra/core/tools';
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

import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { validateBody } from './utils';

/**
 * Resolves a schema value that may be a lazy function (as used by AI SDK provider tools).
 * Provider tools use lazy schemas: `inputSchema` is a function that returns an AI SDK Schema
 * object with `{ jsonSchema, validate, _type }`.
 */
function resolveSchema(schema: unknown): unknown {
  if (typeof schema === 'function') {
    try {
      return schema();
    } catch {
      return undefined;
    }
  }
  return schema;
}

/**
 * Serializes a tool for API responses, handling both regular tools (with Zod schemas)
 * and provider-defined tools (with AI SDK lazy schemas).
 */
function serializeTool(tool: any): any {
  // Provider-defined tools (e.g. google.tools.googleSearch(), openai.tools.webSearch())
  // have lazy inputSchema functions that return AI SDK Schema objects, not Zod schemas.
  // We resolve them and use the jsonSchema property directly.
  if (isProviderDefinedTool(tool)) {
    const resolvedInput = resolveSchema(tool.inputSchema);
    const resolvedOutput = resolveSchema(tool.outputSchema);
    return {
      ...tool,
      inputSchema:
        resolvedInput && typeof resolvedInput === 'object' && 'jsonSchema' in resolvedInput
          ? stringify(resolvedInput.jsonSchema)
          : undefined,
      outputSchema:
        resolvedOutput && typeof resolvedOutput === 'object' && 'jsonSchema' in resolvedOutput
          ? stringify(resolvedOutput.jsonSchema)
          : undefined,
    };
  }

  return {
    ...tool,
    inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
    outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
    requestContextSchema: tool.requestContextSchema ? stringify(zodToJsonSchema(tool.requestContextSchema)) : undefined,
  };
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/tools',
  responseType: 'json',
  responseSchema: listToolsResponseSchema,
  summary: 'List all tools',
  description: 'Returns a list of all available tools in the system',
  tags: ['Tools'],
  requiresAuth: true,
  handler: async ({ mastra, registeredTools }) => {
    try {
      const allTools =
        registeredTools && Object.keys(registeredTools).length > 0 ? registeredTools : mastra.listTools() || {};

      const serializedTools = Object.entries(allTools).reduce(
        (acc, [id, _tool]) => {
          acc[id] = serializeTool(_tool);
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
  path: '/tools/:toolId',
  responseType: 'json',
  pathParamSchema: toolIdPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get tool by ID',
  description: 'Returns details for a specific tool including its schema and configuration',
  tags: ['Tools'],
  requiresAuth: true,
  handler: async ({ mastra, registeredTools, toolId }) => {
    try {
      let tool: any;

      // Try explicit registeredTools first, then fallback to mastra
      if (registeredTools && Object.keys(registeredTools).length > 0) {
        tool = Object.values(registeredTools).find((t: any) => t.id === toolId);
      } else {
        tool = mastra.getToolById(toolId);
      }

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      return serializeTool(tool);
    } catch (error) {
      return handleError(error, 'Error getting tool');
    }
  },
});

export const EXECUTE_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: toolIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: executeToolContextBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute tool',
  description: 'Executes a specific tool with the provided input data',
  tags: ['Tools'],
  requiresAuth: true,
  handler: async ({ mastra, runId, toolId, registeredTools, requestContext, ...bodyParams }) => {
    try {
      if (!toolId) {
        throw new HTTPException(400, { message: 'Tool ID is required' });
      }

      let tool: any;

      // Try explicit registeredTools first, then fallback to mastra
      if (registeredTools && Object.keys(registeredTools).length > 0) {
        tool = Object.values(registeredTools).find((t: any) => t.id === toolId);
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

      if (isVercelTool(tool)) {
        const result = await (tool as any).execute(data);
        return result;
      }

      const result = await tool.execute(data!, {
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
  path: '/agents/:agentId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get agent tool',
  description: 'Returns details for a specific tool assigned to the agent',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, toolId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }
      const agent = await getAgentFromSystem({ mastra, agentId });

      const agentTools = await agent.listTools({ requestContext });

      const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      return serializeTool(tool);
    } catch (error) {
      return handleError(error, 'Error getting agent tool');
    }
  },
});

export const EXECUTE_AGENT_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  bodySchema: executeToolBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute agent tool',
  description: 'Executes a specific tool assigned to the agent with the provided input data',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, toolId, data, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }
      const agent = await getAgentFromSystem({ mastra, agentId });

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
