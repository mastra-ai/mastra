import type { RequestContext } from '@mastra/core/di';
import type { RouteResponse } from '../route-types.generated.js';

import type {
  ClientOptions,
  UpdateMemoryThreadParams,
  ListMemoryThreadMessagesParams,
  ListMemoryThreadMessagesResponse,
  CloneMemoryThreadParams,
  CloneMemoryThreadResponse,
  TransferMemoryThreadParams,
} from '../types';

import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

/**
 * Serializes the message-listing filters both memory message routes accept. The network route
 * takes the same filters under a different path, so the two callers share one serializer.
 */
export const memoryMessagesQuery = ({
  agentId,
  resourceId,
  page,
  perPage,
  orderBy,
  filter,
  include,
  includeSystemReminders,
}: ListMemoryThreadMessagesParams): URLSearchParams => {
  const query = new URLSearchParams();
  if (agentId) query.set('agentId', agentId);
  if (resourceId) query.set('resourceId', resourceId);
  if (page !== undefined) query.set('page', String(page));
  if (perPage !== undefined) query.set('perPage', String(perPage));
  if (orderBy) query.set('orderBy', JSON.stringify(orderBy));
  if (filter) query.set('filter', JSON.stringify(filter));
  if (include) query.set('include', JSON.stringify(include));
  if (includeSystemReminders !== undefined) query.set('includeSystemReminders', String(includeSystemReminders));
  return query;
};

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
  get(requestContext?: RequestContext | Record<string, any>): Promise<RouteResponse<'GET /memory/threads/:threadId'>> {
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
  update(params: UpdateMemoryThreadParams): Promise<RouteResponse<'PATCH /memory/threads/:threadId'>> {
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
  ): Promise<RouteResponse<'DELETE /memory/threads/:threadId'>> {
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
    const query = memoryMessagesQuery({ ...params, agentId: params.agentId ?? this.agentId }).toString();
    const url = `/memory/threads/${this.threadId}/messages${query ? `?${query}` : ''}${requestContextQueryString(params.requestContext, query ? '&' : '?')}`;
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
  ): Promise<RouteResponse<'POST /memory/messages/delete'>> {
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

  /**
   * Transfers ownership of the thread (and all of its messages) to a different resource.
   *
   * This is a privileged operation: the server rejects it when the caller is resource-scoped
   * (i.e. a per-user/tenant context). Unlike `update`, it does not reset the thread's `createdAt`.
   * @param params - Transfer parameters including the target `resourceId`, optional `agentId`, and request context.
   * @returns Promise containing the transferred thread with its new `resourceId`
   */
  transfer(params: TransferMemoryThreadParams): Promise<RouteResponse<'POST /memory/threads/:threadId/transfer'>> {
    const { agentId, requestContext, ...body } = params;
    const resolvedAgentId = agentId ?? this.agentId;
    const agentIdParam = resolvedAgentId ? `?agentId=${resolvedAgentId}` : '';
    const contextParam = requestContextQueryString(requestContext, agentIdParam ? '&' : '?');
    return this.request(`/memory/threads/${this.threadId}/transfer${agentIdParam}${contextParam}`, {
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
