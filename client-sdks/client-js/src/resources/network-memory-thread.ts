import type { StorageThreadType } from '@mastra/core/memory';

import type {
  GetMemoryThreadMessagesResponse,
  ClientOptions,
  UpdateMemoryThreadParams,
  GetMemoryThreadMessagesParams,
} from '../types';

import { BaseResource } from './base';

export class NetworkMemoryThread extends BaseResource {
  constructor(
    options: ClientOptions,
    private threadId: string,
    private networkId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves the memory thread details
   * @returns Promise containing thread details including title and metadata
   */
  get(): Promise<StorageThreadType> {
    return this.request(`/api/memory/network/threads/${this.threadId}?networkId=${this.networkId}`);
  }

  /**
   * Updates the memory thread properties
   * @param params - Update parameters including title and metadata
   * @returns Promise containing updated thread details
   */
  update(params: UpdateMemoryThreadParams): Promise<StorageThreadType> {
    return this.request(`/api/memory/network/threads/${this.threadId}?networkId=${this.networkId}`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes the memory thread
   * @returns Promise containing deletion result
   */
  delete(): Promise<{ result: string }> {
    return this.request(`/api/memory/network/threads/${this.threadId}?networkId=${this.networkId}`, {
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
      networkId: this.networkId,
      ...(params?.limit ? { limit: params.limit.toString() } : {}),
    });
    return this.request(`/api/memory/network/threads/${this.threadId}/messages?${query.toString()}`);
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
      networkId: this.networkId,
    });
    return this.request(`/api/memory/network/messages/delete?${query.toString()}`, {
      method: 'POST',
      body: { messageIds },
    });
  }
}
