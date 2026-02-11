import type { RequestContext } from '@mastra/core/request-context';

import type {
  ClientOptions,
  StoredScorerResponse,
  UpdateStoredScorerParams,
  DeleteStoredScorerResponse,
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
   * @returns Promise containing stored scorer definition details
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<StoredScorerResponse> {
    return this.request(
      `/stored/scorers/${encodeURIComponent(this.storedScorerId)}${requestContextQueryString(requestContext)}`,
    );
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
}
