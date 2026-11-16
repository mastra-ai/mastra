import { isVercelTool, isProviderDefinedTool } from '@mastra/core/tools';
import { toStandardSchema, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import type { PublicSchema } from '@mastra/schema-compat/schema';
import { stringify } from 'superjson';
import { MastraFGAPermissions } from '../fga-permissions';
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

import { listAgentsVisibleTo } from './agent-access';
import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { stripInjectedToolOverrideFields } from './tool-schema-overrides';
import { getHandlerFGAProvider, validateBody } from './utils';

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

function serializeSchema(schema: unknown, options?: { stripInjectedOverrides?: boolean }): string | undefined {
  const jsonSchema = schemaToJsonSchema(resolveLazySchema(schema) as PublicSchema<unknown> | undefined);
  if (jsonSchema === undefined) return undefined;
  return stringify(options?.stripInjectedOverrides ? stripInjectedToolOverrideFields(jsonSchema) : jsonSchema);
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
  const agents = listAgentsVisibleTo(mastra.listAgents(), requestContext);
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
 * Resolves a tool the way the tool routes do: `registeredTools` by `tool.id`, then `mastra.getToolById`
 * (by `tool.id`, then registration key), then tools resolved by agents.
 */
export async function findTool({
  mastra,
  registeredTools,
  toolId,
  requestContext,
}: {
  mastra: any;
  registeredTools?: Record<string, any>;
  toolId: string;
  requestContext?: any;
}): Promise<any | undefined> {
  if (registeredTools && Object.keys(registeredTools).length > 0) {
    const tool = Object.values(registeredTools).find((t: any) => t.id === toolId);
    if (tool) return tool;
  }
  try {
    const tool = mastra.getToolById(toolId);
    if (tool) return tool;
  } catch {
    // tool not found in global registry, continue to agent fallback
  }
  // Fallback: search dynamically-resolved agent tools (toolsResolver)
  return findToolInAgents(mastra, toolId, requestContext);
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
    inputSchema: serializeSchema(tool.inputSchema, { stripInjectedOverrides: true }),
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
  mcp: {
    toolset: 'tools',
    name: 'list_tools',
    description: 'List the tools you can call, with their ids and descriptions.',
  },
  requiresAuth: true,
  handler: async ({ mastra, registeredTools, requestContext }) => {
    try {
      // Merge tools from two sources: mastra.listTools() includes dynamically created tools
      // (e.g. MCP tools, or agent tools registered by their intrinsic id), while registeredTools
      // includes tools discovered by the CLI bundler (keyed by export name).
      //
      // The same tool instance can appear in both maps under different keys (e.g. an agent
      // registers it by `tool.id` while the bundler registers it by export name). Dedupe by
      // `tool.id`, preferring the registeredTools (bundler) key, so each tool appears once.
      const registered = registeredTools && Object.keys(registeredTools).length > 0 ? registeredTools : {};

      const allTools: Record<string, any> = {};
      const seenToolIds = new Map<string, string>();

      // registeredTools first so their key wins for a given tool.id.
      for (const [key, tool] of Object.entries(registered)) {
        const toolId = typeof (tool as any)?.id === 'string' ? (tool as any).id : undefined;
        if (toolId !== undefined) seenToolIds.set(toolId, key);
        allTools[key] = tool;
      }

      for (const [key, tool] of Object.entries(mastra.listTools() ?? {})) {
        const toolId = typeof (tool as any)?.id === 'string' ? (tool as any).id : undefined;
        // Skip if this exact tool.id was already registered (under any key) by registeredTools.
        if (toolId !== undefined && seenToolIds.has(toolId)) continue;
        if (toolId !== undefined) seenToolIds.set(toolId, key);
        allTools[key] = tool;
      }

      const serializedTools = Object.entries(allTools).reduce<Record<string, any>>((acc, [id, _tool]) => {
        acc[id] = serializeTool(_tool);
        return acc;
      }, {});

      // Filter tools by FGA if configured
      const fgaProvider = getHandlerFGAProvider(mastra, requestContext);
      const user = requestContext?.get('user');
      if (fgaProvider && user) {
        // FGA checks a tool by its `tool.id` (as POST /tools/:toolId/execute does); the response is keyed by
        // registration key, which can differ.
        const toolList = Object.entries(serializedTools).map(([key, t]) => ({ ...t, id: t?.id ?? key, key }));
        const accessible = await fgaProvider.filterAccessible(user, toolList, 'tool', MastraFGAPermissions.TOOLS_READ);
        const accessibleSet = new Set(accessible.map((t: any) => t.key));
        for (const key of Object.keys(serializedTools)) {
          if (!accessibleSet.has(key)) {
            delete serializedTools[key];
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
  mcp: {
    toolset: 'tools',
    name: 'get_tool',
    description: 'Get details for one tool, including its input schema.',
  },
  requiresAuth: true,
  handler: async ({ mastra, registeredTools, toolId, requestContext }) => {
    try {
      const tool: any = await findTool({ mastra, registeredTools, toolId, requestContext });

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
  mcp: {
    toolset: 'tools',
    name: 'call_tool',
    description: 'Call a tool with input data that matches its input schema (see get_tool).',
  },
  requiresAuth: true,
  handler: async ({ mastra, runId, toolId, registeredTools, requestContext, ...bodyParams }) => {
    try {
      if (!toolId) {
        throw new HTTPException(400, { message: 'Tool ID is required' });
      }

      const tool: any = await findTool({ mastra, registeredTools, toolId, requestContext });

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
  handler: async ({ mastra, agentId, toolId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }
      const agent = await getAgentFromSystem({ mastra, agentId, requestContext, access: 'read' });

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
      const agent = await getAgentFromSystem({ mastra, agentId, requestContext });

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
