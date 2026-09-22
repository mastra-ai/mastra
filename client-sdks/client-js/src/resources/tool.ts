import type { RequestContext } from '@mastra/core/request-context';
import type { Body, PathParams, RouteResponse } from '../route-types.generated.js';
import type { GetToolResponse, ClientOptions } from '../types';

import { parseClientRequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';

type ToolId = PathParams<'GET /tools/:toolId'>['toolId'];

export class Tool extends BaseResource {
  constructor(
    options: ClientOptions,
    private toolId: ToolId,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the tool
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing tool details including description and schemas
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetToolResponse> {
    return this.request(`/tools/${this.toolId}${requestContextQueryString(requestContext)}`);
  }

  /**
   * Executes the tool with the provided parameters
   * @param params - Parameters required for tool execution
   * @returns Promise containing the tool execution results
   */
  execute(
    params: Omit<Body<'POST /tools/:toolId/execute'>, 'requestContext'> & {
      runId?: string;
      requestContext?: RequestContext | Record<string, any>;
    },
  ): Promise<RouteResponse<'POST /tools/:toolId/execute'>> {
    const url = new URLSearchParams();

    if (params.runId) {
      url.set('runId', params.runId);
    }

    const body: Body<'POST /tools/:toolId/execute'> = {
      data: params.data,
      requestContext: parseClientRequestContext(params.requestContext),
    };

    return this.request(`/tools/${this.toolId}/execute?${url.toString()}`, {
      method: 'POST',
      body,
    });
  }
}
