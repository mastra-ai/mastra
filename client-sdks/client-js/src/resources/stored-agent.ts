import type { RequestContext } from '@mastra/core/request-context';

import type { ClientOptions, StoredAgentResponse, UpdateStoredAgentParams, DeleteStoredAgentResponse } from '../types';
import { requestContextQueryString } from '../utils';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific stored agent
 */
export class StoredAgent extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedAgentId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the stored agent
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing stored agent details
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<StoredAgentResponse> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Updates the stored agent with the provided fields
   * @param params - Fields to update
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the updated stored agent
   */
  update(
    params: UpdateStoredAgentParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<StoredAgentResponse> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the stored agent
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion confirmation
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<DeleteStoredAgentResponse> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }
}
