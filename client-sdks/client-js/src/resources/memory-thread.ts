import type { RuntimeContext } from '@mastra/core/di';
import type { StorageThreadType } from '@mastra/core/memory';

import type {
  GetMemoryThreadMessagesResponse,
  ClientOptions,
  UpdateMemoryThreadParams,
  GetMemoryThreadMessagesParams,
  GetMemoryThreadMessagesPaginatedParams,
  GetMemoryThreadMessagesPaginatedResponse,
} from '../types';

import { runtimeContextQueryString } from '../utils';
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
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing thread details including title and metadata
   */
  get(runtimeContext?: RuntimeContext | Record<string, any>): Promise<StorageThreadType> {
    return this.request(
      `/api/memory/threads/${this.threadId}?agentId=${this.agentId}${runtimeContextQueryString(runtimeContext, '&')}`,
    );
  }

  /**
   * Updates the memory thread properties
   * @param params - Update parameters including title, metadata, and optional runtime context
   * @returns Promise containing updated thread details
   */
  update(params: UpdateMemoryThreadParams): Promise<StorageThreadType> {
    return this.request(
      `/api/memory/threads/${this.threadId}?agentId=${this.agentId}${runtimeContextQueryString(params.runtimeContext, '&')}`,
      {
        method: 'PATCH',
        body: params,
      },
    );
  }

  /**
   * Deletes the memory thread
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing deletion result
   */
  delete(runtimeContext?: RuntimeContext | Record<string, any>): Promise<{ result: string }> {
    return this.request(
      `/api/memory/threads/${this.threadId}?agentId=${this.agentId}${runtimeContextQueryString(runtimeContext, '&')}`,
      {
        method: 'DELETE',
      },
    );
  }

  /**
   * Retrieves messages associated with the thread
   * @param params - Optional parameters including limit for number of messages to retrieve and runtime context
   * @returns Promise containing thread messages and UI messages
   */
  getMessages(
    params?: GetMemoryThreadMessagesParams & { runtimeContext?: RuntimeContext | Record<string, any> },
  ): Promise<GetMemoryThreadMessagesResponse> {
    const query = new URLSearchParams({
      agentId: this.agentId,
      ...(params?.limit ? { limit: params.limit.toString() } : {}),
    });
    return this.request(
      `/api/memory/threads/${this.threadId}/messages?${query.toString()}${runtimeContextQueryString(params?.runtimeContext, '&')}`,
    );
  }

  /**
   * Retrieves paginated messages associated with the thread with advanced filtering and selection options
   * @param params - Pagination parameters including selectBy criteria, page, perPage, date ranges, message inclusion options, and runtime context
   * @returns Promise containing paginated thread messages with pagination metadata (total, page, perPage, hasMore)
   */
  getMessagesPaginated({
    selectBy,
    runtimeContext,
    ...rest
  }: GetMemoryThreadMessagesPaginatedParams & {
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<GetMemoryThreadMessagesPaginatedResponse> {
    const query = new URLSearchParams({
      ...rest,
      ...(selectBy ? { selectBy: JSON.stringify(selectBy) } : {}),
    });
    return this.request(
      `/api/memory/threads/${this.threadId}/messages/paginated?${query.toString()}${runtimeContextQueryString(runtimeContext, '&')}`,
    );
  }

  /**
   * Deletes one or more messages from the thread
   * @param messageIds - Can be a single message ID (string), array of message IDs,
   *                     message object with id property, or array of message objects
   * @param runtimeContext - Optional runtime context to pass as query parameter
   * @returns Promise containing deletion result
   */
  deleteMessages(
    messageIds: string | string[] | { id: string } | { id: string }[],
    runtimeContext?: RuntimeContext | Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    const query = new URLSearchParams({
      agentId: this.agentId,
    });
    return this.request(
      `/api/memory/messages/delete?${query.toString()}${runtimeContextQueryString(runtimeContext, '&')}`,
      {
        method: 'POST',
        body: { messageIds },
      },
    );
  }
}
