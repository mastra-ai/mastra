import type { RequestContext } from '@mastra/core/di';
import type { StorageThreadType } from '@mastra/core/memory';

import type {
  ClientOptions,
  UpdateMemoryThreadParams,
  ListMemoryThreadMessagesParams,
  ListMemoryThreadMessagesResponse,
  CloneMemoryThreadParams,
  CloneMemoryThreadResponse,
  BranchMemoryThreadParams,
  BranchMemoryThreadResponse,
  PromoteBranchParams,
  PromoteBranchResponse,
  ListBranchesResponse,
  GetParentThreadResponse,
  GetBranchHistoryResponse,
} from '../types';

import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

/**
 * MemoryThread resource for interacting with memory threads.
 *
 * agentId is optional - when not provided, the server will use storage directly.
 */
export class MemoryThread extends BaseResource {
  constructor(
    options: ClientOptions,
    private threadId: string,
    private agentId?: string,
  ) {
    super(options);
  }

  /**
   * Builds the query string for agentId (if provided)
   */
  private getAgentIdQueryParam(prefix: '?' | '&' = '?'): string {
    return this.agentId ? `${prefix}agentId=${this.agentId}` : '';
  }

  /**
   * Retrieves the memory thread details
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing thread details including title and metadata
   */
  get(requestContext?: RequestContext | Record<string, any>): Promise<StorageThreadType> {
    const agentIdParam = this.getAgentIdQueryParam('?');
    const contextParam = requestContextQueryString(requestContext, agentIdParam ? '&' : '?');
    return this.request(`/api/memory/threads/${this.threadId}${agentIdParam}${contextParam}`);
  }

  /**
   * Updates the memory thread properties
   * @param params - Update parameters including title, metadata, and optional request context
   * @returns Promise containing updated thread details
   */
  update(params: UpdateMemoryThreadParams): Promise<StorageThreadType> {
    const agentIdParam = this.getAgentIdQueryParam('?');
    const contextParam = requestContextQueryString(params.requestContext, agentIdParam ? '&' : '?');
    return this.request(`/api/memory/threads/${this.threadId}${agentIdParam}${contextParam}`, {
      method: 'PATCH',
      body: params,
    });
  }

  /**
   * Deletes the memory thread
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing deletion result
   */
  delete(requestContext?: RequestContext | Record<string, any>): Promise<{ result: string }> {
    const agentIdParam = this.getAgentIdQueryParam('?');
    const contextParam = requestContextQueryString(requestContext, agentIdParam ? '&' : '?');
    return this.request(`/api/memory/threads/${this.threadId}${agentIdParam}${contextParam}`, {
      method: 'DELETE',
    });
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

    if (this.agentId) queryParams.agentId = this.agentId;
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
    const queryParams: Record<string, string> = {};
    if (this.agentId) queryParams.agentId = this.agentId;

    const query = new URLSearchParams(queryParams);
    const queryString = query.toString();
    return this.request(
      `/api/memory/messages/delete${queryString ? `?${queryString}` : ''}${requestContextQueryString(requestContext, queryString ? '&' : '?')}`,
      {
        method: 'POST',
        body: { messageIds },
      },
    );
  }

  /**
   * Clones the thread with all its messages to a new thread
   * @param params - Clone parameters including optional new thread ID, title, metadata, and message filters
   * @returns Promise containing the cloned thread and copied messages
   */
  clone(params: CloneMemoryThreadParams = {}): Promise<CloneMemoryThreadResponse> {
    const { requestContext, ...body } = params;
    const agentIdParam = this.getAgentIdQueryParam('?');
    const contextParam = requestContextQueryString(requestContext, agentIdParam ? '&' : '?');
    return this.request(`/api/memory/threads/${this.threadId}/clone${agentIdParam}${contextParam}`, {
      method: 'POST',
      body,
    });
  }

  /**
   * Branches the thread at a specific message point, creating a new thread that references parent messages
   * Unlike cloning, branched threads share message history with their parent up to the branch point
   * @param params - Branch parameters including optional branch point message ID, new thread ID, title, metadata
   * @returns Promise containing the branched thread and count of inherited messages
   */
  branch(params: BranchMemoryThreadParams = {}): Promise<BranchMemoryThreadResponse> {
    const { requestContext, ...body } = params;
    return this.request(
      `/api/memory/threads/${this.threadId}/branch?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
      {
        method: 'POST',
        body,
      },
    );
  }

  /**
   * Promotes this branch to become the canonical thread
   * Merges branch messages into the parent and optionally archives or deletes parent's divergent messages
   * @param params - Promotion parameters including whether to delete parent messages and archive thread title
   * @returns Promise containing the promoted thread, optional archive thread, and count of archived messages
   */
  promote(params: PromoteBranchParams = {}): Promise<PromoteBranchResponse> {
    const { requestContext, ...body } = params;
    return this.request(
      `/api/memory/threads/${this.threadId}/promote?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
      {
        method: 'POST',
        body,
      },
    );
  }

  /**
   * Lists all threads that were branched from this thread
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing array of branch threads
   */
  listBranches(requestContext?: RequestContext | Record<string, any>): Promise<ListBranchesResponse> {
    return this.request(
      `/api/memory/threads/${this.threadId}/branches?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
    );
  }

  /**
   * Gets the parent thread that this thread was branched from
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the parent thread if this is a branch, null otherwise
   */
  getParent(requestContext?: RequestContext | Record<string, any>): Promise<GetParentThreadResponse> {
    return this.request(
      `/api/memory/threads/${this.threadId}/parent?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
    );
  }

  /**
   * Gets the full branch history chain from the root thread to this thread
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing array of threads from oldest ancestor to this thread
   */
  getBranchHistory(requestContext?: RequestContext | Record<string, any>): Promise<GetBranchHistoryResponse> {
    return this.request(
      `/api/memory/threads/${this.threadId}/history?agentId=${this.agentId}${requestContextQueryString(requestContext, '&')}`,
    );
  }
}
