import type { StorageThreadType } from '@mastra/core';

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
}
