import type { StorageThreadType } from '@mastra/core';

import type {
  CreateMemoryThreadParams,
  GetMemoryThreadMessagesResponse,
  GetMemoryThreadResponse,
  ClientOptions,
  SaveMessageToMemoryParams,
  UpdateMemoryThreadParams,
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
   * @returns Promise containing thread messages and UI messages
   */
  getMessages(): Promise<GetMemoryThreadMessagesResponse> {
    return this.request(`/api/memory/threads/${this.threadId}/messages?agentId=${this.agentId}`);
  }
}
