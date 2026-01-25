import { z } from 'zod';

import { createTool } from '../tool';
import type { ToolExecutionContext } from '../types';
import { createToolRegistry } from './registry';
import { loadedToolsState, getLoadedToolNames } from './state';
import type { AnyTool, DynamicToolSet, DynamicToolSetConfig, ToolRegistry } from './types';

/**
 * Default descriptions for the search and load tools.
 */
const DEFAULT_SEARCH_DESCRIPTION = `Search for available tools by keyword.

Use this when you need a capability you don't currently have.
Returns a list of matching tools with their names and descriptions.

After finding a useful tool, use the load_tool to make it available.`;

const DEFAULT_LOAD_DESCRIPTION = `Load a specific tool into your context.

Call this after finding a tool with search_tools.
Once loaded, the tool will be available for use on subsequent turns.

Args:
  toolName: The exact name of the tool to load (from search results).`;

/**
 * Create a dynamic tool set that enables agents to discover and load tools on demand.
 *
 * This implements the "Tool Search" pattern which dramatically reduces context usage
 * by keeping most tools hidden until the agent explicitly searches for and loads them.
 *
 * @example Basic usage
 * ```typescript
 * import { createDynamicToolSet } from '@mastra/core/tools/dynamic';
 *
 * const { searchTool, loadTool, getLoadedTools, registry } = createDynamicToolSet({
 *   tools: {
 *     createIssue: githubTools.createIssue,
 *     createPR: githubTools.createPR,
 *     searchCode: githubTools.searchCode,
 *     // ... many more tools
 *   },
 * });
 *
 * const agent = new Agent({
 *   name: 'my-agent',
 *   tools: {
 *     searchTool,
 *     loadTool,
 *     // Always-available tools
 *     getTime: timeTools.getTime,
 *   },
 * });
 *
 * // During execution, include loaded tools via toolsets
 * const result = await agent.generate(prompt, {
 *   threadId: 'conversation-123',
 *   toolsets: {
 *     dynamic: await getLoadedTools({ threadId: 'conversation-123' }),
 *   },
 * });
 * ```
 *
 * @example With MCP tools
 * ```typescript
 * // MCP tools work just like regular tools
 * const mcpTools = await mcpClient.getTools();
 *
 * const { searchTool, loadTool } = createDynamicToolSet({
 *   tools: mcpTools,
 *   search: { topK: 10 },
 * });
 * ```
 */
export function createDynamicToolSet(config: DynamicToolSetConfig): DynamicToolSet {
  const {
    tools,
    search = {},
    searchToolName = 'search_tools',
    loadToolName = 'load_tool',
    searchToolDescription = DEFAULT_SEARCH_DESCRIPTION,
    loadToolDescription = DEFAULT_LOAD_DESCRIPTION,
  } = config;

  const { topK = 5, minScore = 0 } = search;

  // Create and populate the registry
  const registry: ToolRegistry = createToolRegistry();

  // Handle both array and record formats
  const toolsArray = Array.isArray(tools) ? tools : Object.values(tools);

  for (const tool of toolsArray) {
    registry.register(tool as AnyTool);
  }

  // Create the search tool
  const searchTool = createTool({
    id: searchToolName,
    description: searchToolDescription,
    inputSchema: z.object({
      query: z.string().describe('Search keywords (e.g., "weather", "github issue", "database query")'),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          score: z.number(),
        }),
      ),
      message: z.string(),
    }),
    execute: async ({ query }) => {
      const results = registry.search(query, topK, minScore);

      if (results.length === 0) {
        return {
          results: [],
          message: `No tools found matching "${query}". Try different keywords.`,
        };
      }

      return {
        results,
        message: `Found ${results.length} tool(s). Use load_tool with the exact tool name to make it available.`,
      };
    },
  });

  // Create the load tool
  const loadTool = createTool({
    id: loadToolName,
    description: loadToolDescription,
    inputSchema: z.object({
      toolName: z.string().describe('The exact name of the tool to load (from search results)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      toolName: z.string().optional(),
    }),
    execute: async ({ toolName }, context?: ToolExecutionContext) => {
      // Check if tool exists
      const tool = registry.get(toolName);
      if (!tool) {
        const availableTools = registry.getToolNames();
        const suggestions = availableTools.filter(name =>
          name.toLowerCase().includes(toolName.toLowerCase()) ||
          toolName.toLowerCase().includes(name.toLowerCase()),
        );

        let message = `Tool "${toolName}" not found.`;
        if (suggestions.length > 0) {
          message += ` Did you mean: ${suggestions.slice(0, 3).join(', ')}?`;
        } else {
          message += ' Use search_tools to find available tools.';
        }

        return {
          success: false,
          message,
        };
      }

      // Check if already loaded
      if (context) {
        const isLoaded = await loadedToolsState.isToolLoaded(context, toolName);
        if (isLoaded) {
          return {
            success: true,
            message: `Tool "${toolName}" is already loaded and available.`,
            toolName,
          };
        }

        // Add to loaded tools
        await loadedToolsState.addLoadedTool(context, toolName);
      }

      return {
        success: true,
        message: `Tool "${toolName}" loaded successfully. It will be available on your next turn.`,
        toolName,
      };
    },
  });

  // Function to get currently loaded tools
  async function getLoadedTools(
    context: ToolExecutionContext | { threadId?: string },
  ): Promise<Record<string, AnyTool>> {
    const loadedNames = await getLoadedToolNames(context);
    const loadedTools: Record<string, AnyTool> = {};

    for (const name of loadedNames) {
      const tool = registry.get(name);
      if (tool) {
        loadedTools[name] = tool;
      }
    }

    return loadedTools;
  }

  return {
    searchTool: searchTool as unknown as AnyTool,
    loadTool: loadTool as unknown as AnyTool,
    getLoadedTools,
    registry,
  };
}
