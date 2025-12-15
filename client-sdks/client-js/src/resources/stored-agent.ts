import type { ClientOptions, StoredAgentResponse, UpdateStoredAgentParams, DeleteStoredAgentResponse } from '../types';

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
   * @returns Promise containing stored agent details
   */
  details(): Promise<StoredAgentResponse> {
    return this.request(`/api/stored/agents/${encodeURIComponent(this.storedAgentId)}`);
  }

  /**
   * Updates the stored agent with the provided fields
   * @param params - Fields to update
   * @returns Promise containing the updated stored agent
   */
  update(params: UpdateStoredAgentParams): Promise<StoredAgentResponse> {
    return this.request(`/api/stored/agents/${encodeURIComponent(this.storedAgentId)}`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes the stored agent
   * @returns Promise containing deletion confirmation
   */
  delete(): Promise<DeleteStoredAgentResponse> {
    return this.request(`/api/stored/agents/${encodeURIComponent(this.storedAgentId)}`, {
      method: 'DELETE',
    });
  }
}
