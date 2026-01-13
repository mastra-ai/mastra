import type { RequestContext } from '@mastra/core/request-context';

import type {
  ClientOptions,
  StoredAgentResponse,
  UpdateStoredAgentParams,
  DeleteStoredAgentResponse,
  AgentVersionResponse,
  ListAgentVersionsParams,
  ListAgentVersionsResponse,
  CreateAgentVersionParams,
  CompareVersionsResponse,
} from '../types';
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

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  /**
   * Lists all versions for this stored agent
   * @param params - Optional pagination and sorting parameters
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing paginated list of versions
   */
  listVersions(
    params?: ListAgentVersionsParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ListAgentVersionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.set('page', String(params.page));
    if (params?.perPage !== undefined) queryParams.set('perPage', String(params.perPage));
    if (params?.orderBy) queryParams.set('orderBy', params.orderBy);
    if (params?.orderDirection) queryParams.set('orderDirection', params.orderDirection);

    const queryString = queryParams.toString();
    const contextString = requestContextQueryString(requestContext);
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions${queryString ? `?${queryString}` : ''}${contextString ? `${queryString ? '&' : '?'}${contextString.slice(1)}` : ''}`,
    );
  }

  /**
   * Creates a new version snapshot for this stored agent
   * @param params - Optional name and change message for the version
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the created version
   */
  createVersion(
    params?: CreateAgentVersionParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<AgentVersionResponse> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
        body: params || {},
      },
    );
  }

  /**
   * Retrieves a specific version by its ID
   * @param versionId - The ULID of the version to retrieve
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the version details
   */
  getVersion(versionId: string, requestContext?: RequestContext | Record<string, any>): Promise<AgentVersionResponse> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Activates a specific version, making it the active version for this agent
   * @param versionId - The ULID of the version to activate
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise that resolves when activation is complete
   */
  activateVersion(versionId: string, requestContext?: RequestContext | Record<string, any>): Promise<void> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions/${encodeURIComponent(versionId)}/activate${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Restores a version by creating a new version with the same configuration
   * @param versionId - The ULID of the version to restore
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the newly created version
   */
  restoreVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<AgentVersionResponse> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions/${encodeURIComponent(versionId)}/restore${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Deletes a specific version
   * @param versionId - The ULID of the version to delete
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise that resolves when deletion is complete
   */
  deleteVersion(versionId: string, requestContext?: RequestContext | Record<string, any>): Promise<void> {
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Compares two versions and returns their differences
   * @param fromId - The ULID of the source version
   * @param toId - The ULID of the target version
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the comparison results
   */
  compareVersions(
    fromId: string,
    toId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<CompareVersionsResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('from', fromId);
    queryParams.set('to', toId);

    const contextString = requestContextQueryString(requestContext);
    return this.request(
      `/api/stored/agents/${encodeURIComponent(this.storedAgentId)}/versions/compare?${queryParams.toString()}${contextString ? `&${contextString.slice(1)}` : ''}`,
    );
  }
}
