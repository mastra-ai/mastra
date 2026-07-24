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

  details(): Promise<StoredWorkflowDefinition> {
    return this.request(`/stored/workflows/${encodeURIComponent(this.storedWorkflowId)}`);
  }

  delete(): Promise<DeleteStoredWorkflowResponse> {
    return this.request(`/stored/workflows/${encodeURIComponent(this.storedWorkflowId)}`, {
      method: 'DELETE',
    });
  }
}
