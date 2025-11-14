import type { RequestContext } from '@mastra/core/di';
import type { StorageThreadType } from '@mastra/core/memory';

import type {
  ClientOptions,
  UpdateMemoryThreadParams,
  ListMemoryThreadMessagesParams,
  ListMemoryThreadMessagesResponse,
} from '../types';

import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

export class MemoryThread extends BaseResource {
  constructor(
    options: ClientOptions,
    private threadId: string,
    private agentId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves the memory thread details
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing thread details including title and metadata
   */
  get(requestContext?: RequestContext | Record<string, any>): Promise<StorageThreadType> {
    return this.request(
      `/api/memory/threads/${this.threadId}?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
    );
  }

  /**
   * Updates the memory thread properties
   * @param params - Update parameters including title, metadata, and optional request context
   * @returns Promise containing updated thread details
   */
  update(params: UpdateMemoryThreadParams): Promise<StorageThreadType> {
    return this.request(
      `/api/memory/threads/${this.threadId}?agentId=${this.agentId}${requestContextQueryString(params.requestContext, '&')}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the memory thread
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion result
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<{ result: string }> {
    return this.request(
      `/api/memory/threads/${this.threadId}?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Retrieves paginated messages associated with the thread with filtering and ordering options
   * @param params - Pagination parameters including page, perPage, orderBy, filter, include options, and request context
   * @returns Promise containing paginated thread messages with pagination metadata (total, page, perPage, hasMore)
   */
  listMessages(
    params: ListMemoryThreadMessagesParams & {
      requestContext?: RequestContext | Record<string, any>;
    } = {},
  ): Promise<ListMemoryThreadMessagesResponse> {
    const { page, perPage, orderBy, filter, include, resourceId, requestContext } = params;
    const queryParams: Record<string, string> = {};

    if (resourceId) queryParams.resourceId = resourceId;
    if (page !== undefined) queryParams.page = String(page);
    if (perPage !== undefined) queryParams.perPage = String(perPage);
    if (orderBy) queryParams.orderBy = JSON.stringify(orderBy);
    if (filter) queryParams.filter = JSON.stringify(filter);
    if (include) queryParams.include = JSON.stringify(include);

    const query = new URLSearchParams(queryParams);
    const queryString = query.toString();
    const url = `/api/memory/threads/${this.threadId}/messages${queryString ? `?${queryString}` : ''}${requestContextQueryString(requestContext, queryString ? '&' : '?')}`;
    return this.request(url);
  }

  /**
   * Deletes one or more messages from the thread
   * @param messageIds - Can be a single message ID (string), array of message IDs,
   *                     message object with id property, or array of message objects
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion result
   */
  deleteMessages(
    messageIds: string | string[] | { id: string } | { id: string }[],
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    const query = new URLSearchParams({
      agentId: this.agentId,
    });
    return this.request(
      `/api/memory/messages/delete?${query.toString()}${requestContextQueryString(requestContext, '&')}`,
      {
        method: 'POST',
        body: { messageIds },
      },
    );
  }
}
