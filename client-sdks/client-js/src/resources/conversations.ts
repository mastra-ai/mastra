import type { RequestContext } from '@mastra/core/request-context';
import type { ClientOptions, Conversation, ConversationItemsPage, CreateConversationParams } from '../types';
import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

export class Conversations extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  create(params: CreateConversationParams): Promise<Conversation> {
    const { requestContext, ...body } = params;
    return this.request(`/v1/conversations${requestContextQueryString(requestContext)}`, {
      method: 'POST',
      body,
    });
  }

  retrieve(
    conversationId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ConversationItemsPage> {
    return this.request(
      `/v1/conversations/${encodeURIComponent(conversationId)}/items${requestContextQueryString(requestContext)}`,
    );
  }
}
