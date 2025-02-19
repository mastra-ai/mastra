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
  execute(params: { data: any }): Promise<any> {
    return this.request(`/api/tools/${this.toolId}/execute`, {
      method: 'POST',
      body: params,
    });
  }
}
