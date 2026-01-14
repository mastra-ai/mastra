import type {
  ClientOptions,
  WorkflowDefinitionResponse,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinitionVersionResponse,
  ListWorkflowDefinitionVersionsParams,
  ListWorkflowDefinitionVersionsResponse,
  CreateWorkflowDefinitionVersionInput,
  CompareWorkflowDefinitionVersionsResponse,
} from '../types';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific workflow definition
 */
export class WorkflowDefinition extends BaseResource {
  constructor(
    options: ClientOptions,
    private workflowDefinitionId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the workflow definition
   * @returns Promise containing workflow definition details
   */
  details(): Promise<WorkflowDefinitionResponse> {
    return this.request(`/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}`);
  }

  /**
   * Updates the workflow definition with the provided fields
   * @param params - Fields to update
   * @returns Promise containing the updated workflow definition
   */
  update(params: UpdateWorkflowDefinitionInput): Promise<WorkflowDefinitionResponse> {
    return this.request(`/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes the workflow definition
   * @returns Promise containing deletion confirmation
   */
  delete(): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Version Methods
  // ============================================================================

  /**
   * Lists versions of this workflow definition with optional pagination
   * @param params - Optional pagination parameters
   * @returns Promise containing paginated list of versions
   */
  listVersions(params?: ListWorkflowDefinitionVersionsParams): Promise<ListWorkflowDefinitionVersionsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }

    const queryString = searchParams.toString();
    return this.request(
      `/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}/versions${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Creates a new version of the workflow definition
   * @param params - Optional version creation parameters
   * @returns Promise containing the created version
   */
  createVersion(params?: CreateWorkflowDefinitionVersionInput): Promise<WorkflowDefinitionVersionResponse> {
    return this.request(`/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}/versions`, {
      method: 'POST',
      body: params || {},
    });
  }

  /**
   * Gets a specific version by ID
   * @param versionId - ID of the version to retrieve
   * @returns Promise containing the version details
   */
  getVersion(versionId: string): Promise<WorkflowDefinitionVersionResponse> {
    return this.request(
      `/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}/versions/${encodeURIComponent(versionId)}`,
    );
  }

  /**
   * Activates a specific version
   * @param versionId - ID of the version to activate
   * @returns Promise containing the updated workflow definition
   */
  activateVersion(versionId: string): Promise<WorkflowDefinitionResponse> {
    return this.request(
      `/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}/versions/${encodeURIComponent(versionId)}/activate`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Deletes a specific version
   * @param versionId - ID of the version to delete
   * @returns Promise containing deletion confirmation
   */
  deleteVersion(versionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}/versions/${encodeURIComponent(versionId)}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Compares two versions
   * @param versionId1 - ID of the first version
   * @param versionId2 - ID of the second version
   * @returns Promise containing the comparison result
   */
  compareVersions(versionId1: string, versionId2: string): Promise<CompareWorkflowDefinitionVersionsResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set('version1', versionId1);
    searchParams.set('version2', versionId2);

    return this.request(
      `/api/workflow-definitions/${encodeURIComponent(this.workflowDefinitionId)}/versions/compare?${searchParams.toString()}`,
    );
  }
}
