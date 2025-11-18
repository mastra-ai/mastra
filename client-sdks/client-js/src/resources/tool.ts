import type { RequestContext } from '@mastra/core/request-context';
import type { GetToolResponse, ClientOptions } from '../types';

import { parseClientRequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';

export class Tool extends BaseResource {
  constructor(
    options: ClientOptions,
    private toolId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the tool
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing tool details including description and schemas
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetToolResponse> {
    return this.request(`/api/tools/${this.toolId}${requestContextQueryString(requestContext)}`);
  }

  /**
   * Executes the tool with the provided parameters
   * @param params - Parameters required for tool execution
   * @returns Promise containing the tool execution results
   */
  execute(params: { data: any; runId?: string; requestContext?: RequestContext | Record<string, any> }): Promise<any> {
    const url = new URLSearchParams();

    if (params.runId) {
      url.set('runId', params.runId);
    }

    const body = {
      data: params.data,
      requestContext: parseClientRequestContext(params.requestContext),
    };

    return this.request(`/api/tools/${this.toolId}/execute?${url.toString()}`, {
      method: 'POST',
      body,
    });
  }
}
