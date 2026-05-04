import type { RequestContext } from '@mastra/core/request-context';
import type {
  ClientOptions,
  Conversation,
  ConversationDeleted,
  ConversationItemsPage,
  CreateConversationParams,
} from '../types';
import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

export class ConversationItems extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  list(conversationId: string, requestContext?: RequestContext | Record<string, any>): Promise<ConversationItemsPage> {
    return this.request(
      `/v1/conversations/${encodeURIComponent(conversationId)}/items${requestContextQueryString(requestContext)}`,
    );
  }
}

export class Conversations extends BaseResource {
  public readonly items: ConversationItems;

  constructor(options: ClientOptions) {
    super(options);
    this.items = new ConversationItems(options);
  }

  create(params: CreateConversationParams): Promise<Conversation> {
    const { requestContext, ...body } = params;
    return this.request(`/v1/conversations${requestContextQueryString(requestContext)}`, {
      method: 'POST',
      body,
    });
  }

  retrieve(conversationId: string, requestContext?: RequestContext | Record<string, any>): Promise<Conversation> {
    return this.request(
      `/v1/conversations/${encodeURIComponent(conversationId)}${requestContextQueryString(requestContext)}`,
    );
  }

  delete(conversationId: string, requestContext?: RequestContext | Record<string, any>): Promise<ConversationDeleted> {
    return this.request(
      `/v1/conversations/${encodeURIComponent(conversationId)}${requestContextQueryString(requestContext)}`,
      {
        method: 'DELETE',
      },
    );
  }
}
