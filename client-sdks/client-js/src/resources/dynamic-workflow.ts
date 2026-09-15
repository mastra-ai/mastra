import type { ClientOptions, DeleteDynamicWorkflowResponse, DynamicWorkflowDefinition } from '../types';

import { BaseResource } from './base';

/** Resource for interacting with a specific dynamic workflow definition. */
export class DynamicWorkflow extends BaseResource {
  constructor(
    options: ClientOptions,
    private dynamicWorkflowId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves the full dynamic workflow definition (schemas, graph, status, metadata)
   * @returns Promise containing the dynamic workflow definition
   */
  details(): Promise<DynamicWorkflowDefinition> {
    return this.request(`/stored/workflows/${encodeURIComponent(this.dynamicWorkflowId)}`);
  }

  /**
   * Deletes the dynamic workflow definition and unregisters it from the server
   * @returns Promise containing the deletion result
   */
  delete(): Promise<DeleteDynamicWorkflowResponse> {
    return this.request(`/stored/workflows/${encodeURIComponent(this.dynamicWorkflowId)}`, {
      method: 'DELETE',
    });
  }
}
