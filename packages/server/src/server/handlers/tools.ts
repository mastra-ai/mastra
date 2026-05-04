import { MastraFGAPermissions } from '@mastra/core/auth/ee';
import { isVercelTool, isProviderDefinedTool } from '@mastra/core/tools';
import { toStandardSchema, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import type { PublicSchema } from '@mastra/schema-compat/schema';
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
 * Resolves a schema that may be a lazy function (e.g. AI SDK provider tools).
 * Recursively resolves until a non-function value is returned.
 * Skips functions that are themselves valid schemas (e.g. ArkType types are
 * callable but also implement StandardSchema via ~standard).
 */
function resolveLazySchema(schema: unknown): unknown {
  if (typeof schema === 'function' && !('~standard' in schema)) {
    return resolveLazySchema(schema());
  }
  return schema;
}

function schemaToJsonSchema(schema: PublicSchema<unknown> | undefined) {
  if (!schema) {
    return undefined;
  }

  return standardSchemaToJSONSchema(toStandardSchema(schema), { target: 'draft-2020-12' });
}

function serializeSchema(schema: unknown): string | undefined {
  const jsonSchema = schemaToJsonSchema(resolveLazySchema(schema) as PublicSchema<unknown> | undefined);
  if (jsonSchema === undefined) return undefined;
  return stringify(jsonSchema);
}

/**
 * Searches dynamically-resolved agent tools (provided via `toolsResolver` /
 * function-based `tools`) for a tool with the given id. Used as a fallback
 * after the static tool registry (`registeredTools` + `mastra.getToolById`)
 * misses, so global tool routes can resolve tools that only exist on agents.
 *
 * Errors thrown by an individual agent's `listTools()` are logged and
 * skipped so a single broken resolver doesn't take down the whole lookup.
 */
async function findToolInAgents(mastra: any, toolId: string, requestContext: any): Promise<any | undefined> {
  const agents = mastra.listAgents() || {};
  for (const agent of Object.values(agents) as any[]) {
    try {
      const agentTools = await agent.listTools({ requestContext });
      const found = Object.values(agentTools || {}).find((t: any) => t.id === toolId);
      if (found) return found;
    } catch (error) {
      mastra.getLogger?.()?.warn?.('Failed to list tools for agent while resolving tool by id', {
        agentId: agent?.id,
        toolId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return undefined;
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
    const resolvedInput = resolveLazySchema(tool.inputSchema);
    const resolvedOutput = resolveLazySchema(tool.outputSchema);
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
    inputSchema: serializeSchema(tool.inputSchema),
    outputSchema: serializeSchema(tool.outputSchema),
    requestContextSchema: serializeSchema(tool.requestContextSchema),
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
  handler: async ({ mastra, registeredTools, requestContext }) => {
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

      // Filter tools by FGA if configured
      const fgaProvider = mastra.getServer?.()?.fga;
      const user = requestContext?.get('user');
      if (fgaProvider && user) {
        const toolList = Object.entries(serializedTools).map(([id, t]) => ({ id, ...t }));
        const accessible = await fgaProvider.filterAccessible(user, toolList, 'tool', MastraFGAPermissions.TOOLS_READ);
        const accessibleSet = new Set(accessible.map((t: any) => t.id));
        for (const id of Object.keys(serializedTools)) {
          if (!accessibleSet.has(id)) {
            delete serializedTools[id];
          }
        }
      }

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
  fga: { resourceType: 'tool', resourceIdParam: 'toolId', permission: MastraFGAPermissions.TOOLS_READ },
  handler: async ({ mastra, registeredTools, toolId, requestContext }) => {
    try {
      let tool: any;

      // Try explicit registeredTools first, then fallback to mastra
      if (registeredTools && Object.keys(registeredTools).length > 0) {
        tool = Object.values(registeredTools).find((t: any) => t.id === toolId);
      }
      if (!tool) {
        try {
          tool = mastra.getToolById(toolId);
        } catch {
          // tool not found in global registry, continue to agent fallback
        }
      }

      // Fallback: search dynamically-resolved agent tools (toolsResolver)
      if (!tool) {
        tool = await findToolInAgents(mastra, toolId, requestContext);
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
  fga: { resourceType: 'tool', resourceIdParam: 'toolId', permission: MastraFGAPermissions.TOOLS_EXECUTE },
  handler: async ({ mastra, runId, toolId, registeredTools, requestContext, ...bodyParams }) => {
    try {
      if (!toolId) {
        throw new HTTPException(400, { message: 'Tool ID is required' });
      }

      let tool: any;

      // Try explicit registeredTools first, then fallback to mastra
      if (registeredTools && Object.keys(registeredTools).length > 0) {
        tool = Object.values(registeredTools).find((t: any) => t.id === toolId);
      }
      if (!tool) {
        try {
          tool = mastra.getToolById(toolId);
        } catch {
          // tool not found in global registry, continue to agent fallback
        }
      }

      // Fallback: search dynamically-resolved agent tools (toolsResolver)
      if (!tool) {
        tool = await findToolInAgents(mastra, toolId, requestContext);
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
  path: '/agents/:agentId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get agent tool',
  description: 'Returns details for a specific tool assigned to the agent',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  fga: {
    resourceType: 'tool',
    resourceId: ({ agentId, toolId }) => `${String(agentId)}:${String(toolId)}`,
    permission: MastraFGAPermissions.TOOLS_READ,
  },
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
  fga: {
    resourceType: 'tool',
    resourceId: ({ agentId, toolId }) => `${String(agentId)}:${String(toolId)}`,
    permission: MastraFGAPermissions.TOOLS_EXECUTE,
  },
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
