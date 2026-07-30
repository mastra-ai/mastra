import type { ClientOptions, DeleteStoredWorkflowResponse, StoredWorkflowDefinition } from '../types';

import { BaseResource } from './base';

/** Resource for interacting with a specific stored workflow definition. */
export class StoredWorkflow extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedWorkflowId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves the full stored workflow definition (schemas, graph, status, metadata)
   * @returns Promise containing the stored workflow definition
   */
  details(): Promise<StoredWorkflowDefinition> {
    return this.request(`/stored/workflows/${encodeURIComponent(this.storedWorkflowId)}`);
  }

  /**
   * Deletes the stored workflow definition and unregisters it from the server
   * @returns Promise containing the deletion result
   */
  delete(): Promise<DeleteStoredWorkflowResponse> {
    return this.request(`/stored/workflows/${encodeURIComponent(this.storedWorkflowId)}`, {
      method: 'DELETE',
    });
  }
}
