import type { StorageThreadType } from '@mastra/core/memory';

import type {
  GetMemoryThreadMessagesResponse,
  ClientOptions,
  UpdateMemoryThreadParams,
  GetMemoryThreadMessagesParams,
  GetMemoryThreadMessagesPaginatedParams,
  GetMemoryThreadMessagesPaginatedResponse,
} from '../types';

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
   * @returns Promise containing thread details including title and metadata
   */
  get(): Promise<StorageThreadType> {
    return this.request(`/api/memory/threads/${this.threadId}?agentId=${this.agentId}`);
  }

  /**
   * Updates the memory thread properties
   * @param params - Update parameters including title and metadata
   * @returns Promise containing updated thread details
   */
  update(params: UpdateMemoryThreadParams): Promise<StorageThreadType> {
    return this.request(`/api/memory/threads/${this.threadId}?agentId=${this.agentId}`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes the memory thread
   * @returns Promise containing deletion result
   */
  delete(): Promise<{ result: string }> {
    return this.request(`/api/memory/threads/${this.threadId}?agentId=${this.agentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Retrieves messages associated with the thread
   * @param params - Optional parameters including limit for number of messages to retrieve
   * @returns Promise containing thread messages and UI messages
   */
  getMessages(params?: GetMemoryThreadMessagesParams): Promise<GetMemoryThreadMessagesResponse> {
    const query = new URLSearchParams({
      agentId: this.agentId,
      ...(params?.limit ? { limit: params.limit.toString() } : {}),
    });
    return this.request(`/api/memory/threads/${this.threadId}/messages?${query.toString()}`);
  }

  /**
   * Retrieves paginated messages associated with the thread with advanced filtering and selection options
   * @param params - Pagination parameters including selectBy criteria, page, perPage, date ranges, and message inclusion options
   * @returns Promise containing paginated thread messages with pagination metadata (total, page, perPage, hasMore)
   */
  getMessagesPaginated({
    selectBy,
    ...rest
  }: GetMemoryThreadMessagesPaginatedParams): Promise<GetMemoryThreadMessagesPaginatedResponse> {
    const query = new URLSearchParams({
      ...rest,
      ...(selectBy ? { selectBy: JSON.stringify(selectBy) } : {}),
    });
    return this.request(`/api/memory/threads/${this.threadId}/messages/paginated?${query.toString()}`);
  }

  /**
   * Deletes one or more messages from the thread
   * @param messageIds - Can be a single message ID (string), array of message IDs,
   *                     message object with id property, or array of message objects
   * @returns Promise containing deletion result
   */
  deleteMessages(
    messageIds: string | string[] | { id: string } | { id: string }[],
  ): Promise<{ success: boolean; message: string }> {
    const query = new URLSearchParams({
      agentId: this.agentId,
    });
    return this.request(`/api/memory/messages/delete?${query.toString()}`, {
      method: 'POST',
      body: { messageIds },
    });
  }
}
