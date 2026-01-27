import { z } from 'zod';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import type { ProcessInputStepArgs, Processor } from '../index';

/**
 * Configuration options for ToolSearchProcessor
 */
export interface ToolSearchProcessorOptions {
  /**
   * All tools that can be searched and loaded dynamically.
   * These tools are not immediately available - they must be discovered via search and loaded on demand.
   */
  tools: Record<string, Tool<any, any>>;

  /**
   * Configuration for the search behavior
   */
  search?: {
    /**
     * Maximum number of tools to return in search results
     * @default 5
     */
    topK?: number;

    /**
     * Minimum relevance score (0-1) for including a tool in search results
     * @default 0
     */
    minScore?: number;
  };
}

/**
 * Processor that enables dynamic tool discovery and loading.
 *
 * Instead of providing all tools to the agent upfront, this processor:
 * 1. Gives the agent two meta-tools: search_tools and load_tool
 * 2. Agent searches for relevant tools using keywords
 * 3. Agent loads specific tools into the conversation on demand
 * 4. Loaded tools become immediately available for use
 *
 * This pattern dramatically reduces context usage when working with many tools (100+).
 *
 * @example
 * ```typescript
 * const toolSearch = new ToolSearchProcessor({
 *   tools: {
 *     createIssue: githubTools.createIssue,
 *     sendEmail: emailTools.send,
 *     // ... 100+ tools
 *   },
 *   search: { topK: 5, minScore: 0 },
 * });
 *
 * const agent = new Agent({
 *   name: 'my-agent',
 *   inputProcessors: [toolSearch],
 *   tools: {}, // Always-available tools (if any)
 * });
 * ```
 */
export class ToolSearchProcessor implements Processor<'tool-search'> {
  readonly id = 'tool-search';
  readonly name = 'Tool Search Processor';
  readonly description = 'Enables dynamic tool discovery and loading via search';

  private allTools: Record<string, Tool<any, any>>;
  private enabledTools: Record<string, Tool<any, any>> = {};
  private searchConfig: Required<NonNullable<ToolSearchProcessorOptions['search']>>;

  constructor(options: ToolSearchProcessorOptions) {
    this.allTools = options.tools;
    this.searchConfig = {
      topK: options.search?.topK ?? 5,
      minScore: options.search?.minScore ?? 0,
    };
  }

  async processInputStep({ tools, messageList }: ProcessInputStepArgs) {
    // Add system instruction about the meta-tools
    messageList.addSystem(
      'To discover available tools, call search_tools with a keyword query. ' +
        'To add a tool to the conversation, call load_tool with the tool name. ' +
        'Tools must be loaded before they can be used.',
    );

    // Create the search tool (currently returns all tools - will be replaced with BM25 in next task)
    const searchTool = createTool({
      id: 'search_tools',
      description: 'Search for available tools by keyword. Returns a ranked list of relevant tools.',
      inputSchema: z.object({
        query: z.string().describe('Search query to find relevant tools'),
      }),
      execute: async ({ query }) => {
        // TODO: Replace with BM25 search in task 002
        // For now, return all tools (simple implementation from Caleb)
        const allToolsList = Object.values(this.allTools).map(tool => ({
          name: tool.id,
          description: tool.description,
          score: 1.0, // Placeholder score
        }));

        // Apply topK limit
        const results = allToolsList.slice(0, this.searchConfig.topK);

        if (results.length === 0) {
          return {
            tools: [],
            message: `No tools found matching query: "${query}"`,
          };
        }

        return {
          tools: results,
          message: `Found ${results.length} tools. Use load_tool to add them to the conversation.`,
        };
      },
    });

    // Create the load tool
    const loadTool = createTool({
      id: 'load_tool',
      description: 'Load a specific tool into the current conversation to make it available for use',
      inputSchema: z.object({
        toolName: z.string().describe('The name/ID of the tool to load'),
      }),
      execute: async ({ toolName }) => {
        // Check if tool exists
        const matchingTool = this.allTools[toolName] ?? Object.values(this.allTools).find(tool => tool.id === toolName);

        if (!matchingTool) {
          // TODO: Add suggestions for similar tool names in task 004
          return {
            success: false,
            message: `Tool "${toolName}" not found. Use search_tools to discover available tools.`,
          };
        }

        // Check if already loaded
        if (this.enabledTools[toolName]) {
          return {
            success: true,
            message: `Tool "${toolName}" is already loaded and available.`,
          };
        }

        // Load the tool
        this.enabledTools[toolName] = matchingTool;

        return {
          success: true,
          message: `Tool "${toolName}" has been loaded and is now available for use.`,
        };
      },
    });

    // Return merged tools: meta-tools + existing tools + loaded tools
    return {
      tools: {
        search_tools: searchTool,
        load_tool: loadTool,
        ...(tools ?? {}),
        ...this.enabledTools,
      },
    };
  }
}
