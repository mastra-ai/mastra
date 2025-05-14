import type { RuntimeContext } from '@mastra/core/di';
import type { GetToolResponse, ClientOptions } from '../types';

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
   * @returns Promise containing tool details including description and schemas
   */
  details(): Promise<GetToolResponse> {
    return this.request(`/api/tools/${this.toolId}`);
  }

  /**
   * Executes the tool with the provided parameters
   * @param params - Parameters required for tool execution
   * @returns Promise containing the tool execution results
   */
  execute(params: { data: any; runId?: string; runtimeContext?: RuntimeContext }): Promise<any> {
    const url = new URLSearchParams();

    if (params.runId) {
      url.set('runId', params.runId);
    }

    const body = {
      data: params.data,
      runtimeContext: params.runtimeContext ? Object.fromEntries(params.runtimeContext.entries()) : undefined,
    };

    return this.request(`/api/tools/${this.toolId}/execute?${url.toString()}`, {
      method: 'POST',
      body,
    });
  }
}
