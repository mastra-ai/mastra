import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { ClientOptions, McpToolInfo } from '../types';
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
   * @returns Promise containing the tool's information (name, description, schema).
   */
  details(): Promise<McpToolInfo> {
    return this.request(`/api/mcp/${this.serverId}/tools/${this.toolId}`);
  }

  /**
   * Executes this specific tool on the MCP server.
   * @param params - Parameters for tool execution, including data/args and optional runtimeContext.
   * @returns Promise containing the result of the tool execution.
   */
  execute(params: { data?: any; runtimeContext?: RuntimeContext }): Promise<any> {
    const body: any = {};
    if (params.data !== undefined) body.data = params.data;
    // If none of data, args the body might be empty or just contain runtimeContext.
    // The handler will look for these, so an empty args object might be appropriate if that's the intent.
    // else body.data = {}; // Or let it be empty if no specific input fields are used

    if (params.runtimeContext !== undefined) {
      body.runtimeContext = params.runtimeContext;
    }

    return this.request(`/api/mcp/${this.serverId}/tools/${this.toolId}/execute`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? body : undefined,
    });
  }
}
