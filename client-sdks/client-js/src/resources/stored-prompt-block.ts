import type { RequestContext } from '@mastra/core/request-context';

import type {
  ClientOptions,
  StoredPromptBlockResponse,
  UpdateStoredPromptBlockParams,
  DeleteStoredPromptBlockResponse,
  PromptBlockVersionResponse,
  ListPromptBlockVersionsParams,
  ListPromptBlockVersionsResponse,
  CreatePromptBlockVersionParams,
  ActivatePromptBlockVersionResponse,
  CompareVersionsResponse,
  DeletePromptBlockVersionResponse,
} from '../types';
import { requestContextQueryString } from '../utils';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific stored prompt block
 */
export class StoredPromptBlock extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedPromptBlockId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the stored prompt block
   * @param requestContext - Optional request context to pass as query parameter
   * @param options - Optional options like status filter
   * @returns Promise containing stored prompt block details
   */
  details(
    requestContext?: RequestContext | Record<string, any>,
    options?: { status?: 'draft' | 'published' | 'archived' },
  ): Promise<StoredPromptBlockResponse> {
    const contextString = requestContextQueryString(requestContext);
    const statusParam = options?.status ? `status=${options.status}` : '';
    const url = `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}${contextString}${statusParam ? `${contextString ? '&' : '?'}${statusParam}` : ''}`;
    return this.request(url);
  }

  /**
   * Updates the stored prompt block with the provided fields
   * @param params - Fields to update
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the updated stored prompt block
   */
  update(
    params: UpdateStoredPromptBlockParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<StoredPromptBlockResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the stored prompt block
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion confirmation
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<DeleteStoredPromptBlockResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  /**
   * Lists all versions for this stored prompt block
   * @param params - Optional pagination and sorting parameters
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing paginated list of versions
   */
  listVersions(
    params?: ListPromptBlockVersionsParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ListPromptBlockVersionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.set('page', String(params.page));
    if (params?.perPage !== undefined) queryParams.set('perPage', String(params.perPage));
    if (params?.orderBy) queryParams.set('orderBy', params.orderBy);
    if (params?.sortDirection) queryParams.set('sortDirection', params.sortDirection);

    const queryString = queryParams.toString();
    const contextString = requestContextQueryString(requestContext, queryString ? '&' : '?');
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions${queryString ? `?${queryString}` : ''}${contextString}`,
    );
  }

  /**
   * Creates a new version snapshot for this stored prompt block
   * @param params - Optional name and change message for the version
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the created version
   */
  createVersion(
    params?: CreatePromptBlockVersionParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<PromptBlockVersionResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
        body: params || {},
      },
    );
  }

  /**
   * Retrieves a specific version by its ID
   * @param versionId - The UUID of the version to retrieve
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the version details
   */
  getVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<PromptBlockVersionResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Activates a specific version, making it the active version for this prompt block
   * @param versionId - The UUID of the version to activate
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing activation confirmation with success status, message, and active version ID
   */
  activateVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ActivatePromptBlockVersionResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions/${encodeURIComponent(versionId)}/activate${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Restores a version by creating a new version with the same configuration
   * @param versionId - The UUID of the version to restore
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the newly created version
   */
  restoreVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<PromptBlockVersionResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions/${encodeURIComponent(versionId)}/restore${requestContextQueryString(requestContext)}`,
      {
        method: 'POST',
      },
    );
  }

  /**
   * Deletes a specific version
   * @param versionId - The UUID of the version to delete
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise that resolves with deletion response
   */
  deleteVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<DeletePromptBlockVersionResponse> {
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Compares two versions and returns their differences
   * @param fromId - The UUID of the source version
   * @param toId - The UUID of the target version
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

    const contextString = requestContextQueryString(requestContext, '&');
    return this.request(
      `/stored/prompt-blocks/${encodeURIComponent(this.storedPromptBlockId)}/versions/compare?${queryParams.toString()}${contextString}`,
    );
  }
}
