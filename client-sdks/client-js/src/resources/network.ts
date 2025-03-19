import type { GenerateReturn } from '@mastra/core';
import type { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { GenerateParams, ClientOptions, StreamParams, GetNetworkResponse } from '../types';

import { BaseResource } from './base';

export class Network extends BaseResource {
  constructor(
    options: ClientOptions,
    private networkId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the network
   * @returns Promise containing network details
   */
  details(): Promise<GetNetworkResponse> {
    return this.request(`/api/networks/${this.networkId}`);
  }

  /**
   * Generates a response from the agent
   * @param params - Generation parameters including prompt
   * @returns Promise containing the generated response
   */
  generate<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: GenerateParams<T>,
  ): Promise<GenerateReturn<T>> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return this.request(`/api/networks/${this.networkId}/generate`, {
      method: 'POST',
      body: processedParams,
    });
  }

  /**
   * Streams a response from the agent
   * @param params - Stream parameters including prompt
   * @returns Promise containing the streamed response
   */
  stream<T extends JSONSchema7 | ZodSchema | undefined = undefined>(params: StreamParams<T>): Promise<Response> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return this.request(`/api/networks/${this.networkId}/stream`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });
  }
}
