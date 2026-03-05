import type { RequestContext } from '@mastra/core/request-context';

import type { ClientOptions, StoredSkillResponse, UpdateStoredSkillParams, DeleteStoredSkillResponse } from '../types';
import { requestContextQueryString } from '../utils';

import { BaseResource } from './base';

/**
 * Resource for interacting with a specific stored skill
 */
export class StoredSkill extends BaseResource {
  constructor(
    options: ClientOptions,
    private storedSkillId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the stored skill
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing stored skill details
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<StoredSkillResponse> {
    return this.request(
      `/stored/skills/${encodeURIComponent(this.storedSkillId)}${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Updates the stored skill with the provided fields
   * @param params - Fields to update
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the updated stored skill
   */
  update(
    params: UpdateStoredSkillParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<StoredSkillResponse> {
    return this.request(
      `/stored/skills/${encodeURIComponent(this.storedSkillId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the stored skill
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion confirmation
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<DeleteStoredSkillResponse> {
    return this.request(
      `/stored/skills/${encodeURIComponent(this.storedSkillId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }
}
