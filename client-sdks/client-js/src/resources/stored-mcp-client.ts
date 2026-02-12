import type { RequestContext } from '@mastra/core/request-context';

import type {
  ClientOptions,
  StoredMCPClientResponse,
  UpdateStoredMCPClientParams,
  DeleteStoredMCPClientResponse,
} from '../types';
import { requestContextQueryString } from '../utils';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific stored MCP client
 */
export class StoredMCPClient extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedMCPClientId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the stored MCP client
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing stored MCP client details
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<StoredMCPClientResponse> {
    return this.request(
      `/stored/mcp-clients/${encodeURIComponent(this.storedMCPClientId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Updates the stored MCP client with the provided fields
   * @param params - Fields to update
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the updated stored MCP client
   */
  update(
    params: UpdateStoredMCPClientParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<StoredMCPClientResponse> {
    return this.request(
      `/stored/mcp-clients/${encodeURIComponent(this.storedMCPClientId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the stored MCP client
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion confirmation
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<DeleteStoredMCPClientResponse> {
    return this.request(
      `/stored/mcp-clients/${encodeURIComponent(this.storedMCPClientId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }
}
