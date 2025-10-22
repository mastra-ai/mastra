import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { ClientOptions, McpToolInfo } from '../types';
import { parseClientRuntimeContext, runtimeContextQueryString } from '../utils';
import { BaseResource } from './base';

/**
 * Represents a specific tool available on a specific MCP server.
 * Provides methods to get details and execute the tool.
 */
export class MCPTool extends BaseResource {
  private serverId: string;
  private toolId: string;

  constructor(options: ClientOptions, serverId: string, toolId: string) {
    super(options);
    this.serverId = serverId;
    this.toolId = toolId;
  }

  /**
   * Retrieves details about this specific tool from the MCP server.
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing the tool's information (name, description, schema).
   */
  details(runtimeContext?: RuntimeContext | Record<string, any>): Promise<McpToolInfo> {
    return this.request(`/api/mcp/${this.serverId}/tools/${this.toolId}${runtimeContextQueryString(runtimeContext)}`);
  }

  /**
   * Executes this specific tool on the MCP server.
   * @param params - Parameters for tool execution, including data/args and optional runtimeContext.
   * @returns Promise containing the result of the tool execution.
   */
  execute(params: {
    data?: any;
    /** @deprecated Use `requestContext` instead. This will be removed in a future version. */
    runtimeContext?: RuntimeContext;
    /** Request context for the tool execution */
    requestContext?: RuntimeContext | Record<string, any>;
  }): Promise<any> {
    const body: any = {};
    if (params.data !== undefined) body.data = params.data;
    // If none of data, args the body might be empty or just contain runtimeContext.
    // The handler will look for these, so an empty args object might be appropriate if that's the intent.
    // else body.data = {}; // Or let it be empty if no specific input fields are used

    if (params.runtimeContext !== undefined || params.requestContext !== undefined) {
      body.runtimeContext = parseClientRuntimeContext(params.requestContext ?? params.runtimeContext);
    }

    return this.request(`/api/mcp/${this.serverId}/tools/${this.toolId}/execute`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? body : undefined,
    });
  }
}
