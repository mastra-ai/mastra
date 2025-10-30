import type { RequestContext } from '@mastra/core/di';
import type { StorageThreadType } from '@mastra/core/memory';

import type {
  GetMemoryThreadMessagesResponse,
  ClientOptions,
  UpdateMemoryThreadParams,
  GetMemoryThreadMessagesParams,
  GetMemoryThreadMessagesPaginatedParams,
  GetMemoryThreadMessagesPaginatedResponse,
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
   * Retrieves messages associated with the thread
   * @param params - Optional parameters including limit for number of messages to retrieve and request context
   * @returns Promise containing thread messages and UI messages
   */
  getMessages(
    params?: GetMemoryThreadMessagesParams & { requestContext?: RequestContext | Record<string, any> },
  ): Promise<GetMemoryThreadMessagesResponse> {
    const query = new URLSearchParams({
      agentId: this.agentId,
      ...(params?.limit ? { limit: params.limit.toString() } : {}),
    });
    return this.request(
      `/api/memory/threads/${this.threadId}/messages?${query.toString()}${requestContextQueryString(params?.requestContext, '&')}`,
    );
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
