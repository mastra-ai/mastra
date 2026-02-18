import type { RequestContext } from '@mastra/core/request-context';

import type {
  ClientOptions,
  StoredScorerResponse,
  UpdateStoredScorerParams,
  DeleteStoredScorerResponse,
  ScorerVersionResponse,
  ListScorerVersionsParams,
  ListScorerVersionsResponse,
  CreateScorerVersionParams,
  ActivateScorerVersionResponse,
  CompareScorerVersionsResponse,
  DeleteScorerVersionResponse,
} from '../types';
import { requestContextQueryString } from '../utils';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific stored scorer definition
 */
export class StoredScorer extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedScorerId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the stored scorer definition
   * @param requestContext - Optional request context to pass as query parameter
   * @param options - Optional options like status filter
   * @returns Promise containing stored scorer definition details
   */
  details(
    requestContext?: RequestContext | Record<string, any>,
    options?: { status?: 'draft' | 'published' | 'archived' },
  ): Promise<StoredScorerResponse> {
    const contextString = requestContextQueryString(requestContext);
    const statusParam = options?.status ? `status=${options.status}` : '';
    const separator = contextString ? '&' : '?';
    const url = `/stored/scorers/${encodeURIComponent(this.storedScorerId)}${contextString}${statusParam ? `${contextString ? separator : '?'}${statusParam}` : ''}`;
    return this.request(url);
  }

  /**
   * Updates the stored scorer definition with the provided fields
   * @param params - Fields to update
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the updated stored scorer definition
   */
  update(
    params: UpdateStoredScorerParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<StoredScorerResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the stored scorer definition
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion confirmation
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<DeleteStoredScorerResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  /**
   * Lists all versions for this stored scorer
   * @param params - Optional pagination and sorting parameters
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing paginated list of versions
   */
  listVersions(
    params?: ListScorerVersionsParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ListScorerVersionsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.set('page', String(params.page));
    if (params?.perPage !== undefined) queryParams.set('perPage', String(params.perPage));
    if (params?.orderBy) queryParams.set('orderBy', params.orderBy);
    if (params?.sortDirection) queryParams.set('sortDirection', params.sortDirection);

    const queryString = queryParams.toString();
    const contextString = requestContextQueryString(requestContext);
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions${queryString ? `?${queryString}` : ''}${contextString ? `${queryString ? '&' : '?'}${contextString.slice(1)}` : ''}`,
    );
  }

  /**
   * Creates a new version snapshot for this stored scorer
   * @param params - Optional change message for the version
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the created version
   */
  createVersion(
    params?: CreateScorerVersionParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ScorerVersionResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions${requestContextQueryString(requestContext)}`,
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
  getVersion(versionId: string, requestContext?: RequestContext | Record<string, any>): Promise<ScorerVersionResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Activates a specific version, making it the active version for this scorer
   * @param versionId - The UUID of the version to activate
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing activation confirmation
   */
  activateVersion(
    versionId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ActivateScorerVersionResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions/${encodeURIComponent(versionId)}/activate${requestContextQueryString(requestContext)}`,
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
  ): Promise<ScorerVersionResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions/${encodeURIComponent(versionId)}/restore${requestContextQueryString(requestContext)}`,
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
  ): Promise<DeleteScorerVersionResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions/${encodeURIComponent(versionId)}${requestContextQueryString(requestContext)}`,
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
  ): Promise<CompareScorerVersionsResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('from', fromId);
    queryParams.set('to', toId);

    const contextString = requestContextQueryString(requestContext);
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}/versions/compare?${queryParams.toString()}${contextString ? `&${contextString.slice(1)}` : ''}`,
    );
  }
}
