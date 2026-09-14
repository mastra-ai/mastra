import type { RequestContext } from '@mastra/core/request-context';
import type { Body } from '../route-types.generated.js';
import type { ClientOptions, McpToolExecuteResponse, McpToolInfo } from '../types';
import { requestContextQueryString } from '../utils';
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
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the tool's information (name, description, schema).
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<McpToolInfo> {
    return this.request(
      `/mcp/${encodeURIComponent(this.serverId)}/tools/${encodeURIComponent(this.toolId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Executes this specific tool on the MCP server.
   * @param params - Parameters for tool execution, including data/args and optional requestContext.
   * On a 2026-07-28 server a tool can answer `{ status: 'suspended', suspendPayload, resumeSchema }`;
   * call again with the same `data` plus `resumeData` (matching `resumeSchema`) and the echoed
   * `suspendPayload` to continue it.
   * @returns Promise containing `{ result }`, or the suspended shape described above.
   */
  execute(
    params: Body<'POST /mcp/:serverId/tools/:toolId/execute'> & { requestContext?: RequestContext },
  ): Promise<McpToolExecuteResponse> {
    const { requestContext, ...body } = params;
    return this.request(
      `/mcp/${encodeURIComponent(this.serverId)}/tools/${encodeURIComponent(this.toolId)}/execute${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
        body,
      },
    );
  }
}
