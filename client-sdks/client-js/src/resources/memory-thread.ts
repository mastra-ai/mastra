import type { RequestContext } from '@mastra/core/di';
import type { StorageThreadType } from '@mastra/core/memory';

import type {
  ClientOptions,
  UpdateMemoryThreadParams,
  ListMemoryThreadMessagesParams,
  ListMemoryThreadMessagesResponse,
  CloneMemoryThreadParams,
  CloneMemoryThreadResponse,
} from '../types';

import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

/**
 * MemoryThread resource for interacting with memory threads.
 *
 * `agentId` is optional for read operations (`get`, `listMessages`) — when omitted the server
 * falls back to the global storage. It is required by the server for write operations
 * (`update`, `delete`, `deleteMessages`, `clone`) because the server needs to resolve which
 * agent's memory pipeline to invoke. Pass `agentId` either on the constructor (via
 * `MastraClient.getMemoryThread({ threadId, agentId })`) or on the per-method params.
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
  private getAgentIdQueryParam(prefix: '?' | '&' = '?', overrideAgentId?: string): string {
    const agentId = overrideAgentId ?? this.agentId;
    return agentId ? `${prefix}agentId=${agentId}` : '';
  }

  /**
   * Resolves the agentId to use for a write request. Prefers the per-call value, falls back
   * to the constructor value, and throws if neither is set.
   */
  private requireAgentId(perCallAgentId: string | undefined, methodName: string): string {
    const agentId = perCallAgentId ?? this.agentId;
    if (!agentId) {
      throw new Error(
        `MemoryThread.${methodName}() requires an agentId. ` +
          `Pass it via getMemoryThread({ threadId, agentId }) or as a parameter to ${methodName}().`,
      );
    }
    return agentId;
  }

  /**
   * Retrieves the memory thread details
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing thread details including title and metadata
   */
  get(requestContext?: RequestContext | Record<string, any>): Promise<StorageThreadType> {
    const agentIdParam = this.getAgentIdQueryParam('?');
    const contextParam = requestContextQueryString(requestContext, agentIdParam ? '&' : '?');
    return this.request(`/memory/threads/${this.threadId}${agentIdParam}${contextParam}`);
  }

  /**
   * Updates the memory thread properties
   * @param params - Update parameters including title, metadata, and optional request context.
   *                 `agentId` is required by the server; pass it here if not supplied on the constructor.
   * @returns Promise containing updated thread details
   */
  update(params: UpdateMemoryThreadParams): Promise<StorageThreadType> {
    const agentId = this.requireAgentId(params.agentId, 'update');
    const { agentId: _omitAgentId, requestContext, ...body } = params;
    const agentIdParam = `?agentId=${agentId}`;
    const contextParam = requestContextQueryString(requestContext, '&');
    return this.request(`/memory/threads/${this.threadId}${agentIdParam}${contextParam}`, {
      method: 'PATCH',
      body,
    });
  }

  /**
   * Deletes the memory thread
   * @param opts - Optional `agentId` (required by the server when not supplied on the constructor)
   *               and request context.
   * @returns Promise containing deletion result
   */
  delete(
    opts: { agentId?: string; requestContext?: RequestContext | Record<string, any> } = {},
  ): Promise<{ result: string }> {
    const agentId = this.requireAgentId(opts.agentId, 'delete');
    const agentIdParam = `?agentId=${agentId}`;
    const contextParam = requestContextQueryString(opts.requestContext, '&');
    return this.request(`/memory/threads/${this.threadId}${agentIdParam}${contextParam}`, {
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
    const { page, perPage, orderBy, filter, include, resourceId, requestContext, includeSystemReminders } = params;
    const queryParams: Record<string, string> = {};

    if (this.agentId) queryParams.agentId = this.agentId;
    if (resourceId) queryParams.resourceId = resourceId;
    if (page !== undefined) queryParams.page = String(page);
    if (perPage !== undefined) queryParams.perPage = String(perPage);
    if (orderBy) queryParams.orderBy = JSON.stringify(orderBy);
    if (filter) queryParams.filter = JSON.stringify(filter);
    if (include) queryParams.include = JSON.stringify(include);
    if (includeSystemReminders !== undefined) queryParams.includeSystemReminders = String(includeSystemReminders);

    const query = new URLSearchParams(queryParams);
    const queryString = query.toString();
    const url = `/memory/threads/${this.threadId}/messages${queryString ? `?${queryString}` : ''}${requestContextQueryString(requestContext, queryString ? '&' : '?')}`;
    return this.request(url);
  }

  /**
   * Deletes one or more messages from the thread
   * @param messageIds - Can be a single message ID (string), array of message IDs,
   *                     message object with id property, or array of message objects
   * @param opts - Optional `agentId` (required by the server when not supplied on the constructor)
   *               and request context. For backwards compatibility a `RequestContext` may also be
   *               passed directly as the second argument.
   * @returns Promise containing deletion result
   */
  deleteMessages(
    messageIds: string | string[] | { id: string } | { id: string }[],
    opts:
      | { agentId?: string; requestContext?: RequestContext | Record<string, any> }
      | RequestContext
      | Record<string, any> = {},
  ): Promise<{ success: boolean; message: string }> {
    const { agentId: explicitAgentId, requestContext } = normalizeWriteOpts(opts);
    const agentId = this.requireAgentId(explicitAgentId, 'deleteMessages');
    const queryString = `agentId=${agentId}`;
    return this.request(`/memory/messages/delete?${queryString}${requestContextQueryString(requestContext, '&')}`, {
      method: 'POST',
      body: { messageIds },
    });
  }

  /**
   * Clones the thread with all its messages to a new thread
   * @param params - Clone parameters including optional new thread ID, title, metadata, and message filters.
   *                 `agentId` is required by the server; pass it here if not supplied on the constructor.
   * @returns Promise containing the cloned thread and copied messages
   */
  clone(params: CloneMemoryThreadParams = {}): Promise<CloneMemoryThreadResponse> {
    const agentId = this.requireAgentId(params.agentId, 'clone');
    const { agentId: _omitAgentId, requestContext, ...body } = params;
    const agentIdParam = `?agentId=${agentId}`;
    const contextParam = requestContextQueryString(requestContext, '&');
    return this.request(`/memory/threads/${this.threadId}/clone${agentIdParam}${contextParam}`, {
      method: 'POST',
      body,
    });
  }
}

/**
 * Backwards-compat helper: `deleteMessages` historically accepted a `RequestContext` (or plain
 * object) as its second argument. Newer callers pass `{ agentId, requestContext }`. This helper
 * normalizes both shapes.
 */
function normalizeWriteOpts(
  opts:
    | { agentId?: string; requestContext?: RequestContext | Record<string, any> }
    | RequestContext
    | Record<string, any>,
): { agentId?: string; requestContext?: RequestContext | Record<string, any> } {
  if (!opts || typeof opts !== 'object') return {};
  if ('agentId' in opts || 'requestContext' in opts) {
    const o = opts as { agentId?: string; requestContext?: RequestContext | Record<string, any> };
    return { agentId: o.agentId, requestContext: o.requestContext };
  }
  // Empty object → no agentId, no requestContext.
  if (Object.keys(opts).length === 0) return {};
  // Legacy shape: caller passed a RequestContext / plain context object directly.
  return { requestContext: opts as RequestContext | Record<string, any> };
}
