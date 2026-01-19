import type { RequestContext } from '@mastra/core/request-context';
import type {
  ClientOptions,
  GetProcessorDetailResponse,
  ExecuteProcessorParams,
  ExecuteProcessorResponse,
} from '../types';

import { parseClientRequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';

export class Processor extends BaseResource {
  constructor(
    options: ClientOptions,
    private processorId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the processor
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing processor details including phases and configurations
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetProcessorDetailResponse> {
    return this.request(`/api/processors/${this.processorId}${requestContextQueryString(requestContext)}`);
  }

  /**
   * Executes the processor with the provided parameters
   * @param params - Parameters required for processor execution including phase and messages
   * @returns Promise containing the processor execution results
   */
  execute(params: ExecuteProcessorParams): Promise<ExecuteProcessorResponse> {
    const body = {
      phase: params.phase,
      messages: params.messages,
      agentId: params.agentId,
      requestContext: parseClientRequestContext(params.requestContext),
    };

    return this.request(`/api/processors/${this.processorId}/execute`, {
      method: 'POST',
      body,
    });
  }
}
