import type { RequestContext } from '@mastra/core/request-context';

import type {
  ClientOptions,
  StoredMCPServerResponse,
  UpdateStoredMCPServerParams,
  DeleteStoredMCPServerResponse,
} from '../types';
import { requestContextQueryString } from '../utils';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific stored MCP server
 */
export class StoredMCPServer extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedMCPServerId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the stored MCP server
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing stored MCP server details
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<StoredMCPServerResponse> {
    return this.request(
      `/stored/mcp-servers/${encodeURIComponent(this.storedMCPServerId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Updates the stored MCP server with the provided fields
   * @param params - Fields to update
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the updated stored MCP server
   */
  update(
    params: UpdateStoredMCPServerParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<StoredMCPServerResponse> {
    return this.request(
      `/stored/mcp-servers/${encodeURIComponent(this.storedMCPServerId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the stored MCP server
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion confirmation
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<DeleteStoredMCPServerResponse> {
    return this.request(
      `/stored/mcp-servers/${encodeURIComponent(this.storedMCPServerId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }
}
