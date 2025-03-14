import type { ClientOptions, GenerateParams, GetNetworkResponse, StreamParams } from '../types';
import { BaseResource } from './base';
import type { GenerateReturn } from '@mastra/core';
import type { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class Network extends BaseResource {
  constructor(
    options: ClientOptions,
    private networkId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the network
   * @returns Promise containing network details including agents and routing model
   */
  details(): Promise<GetNetworkResponse> {
    return this.request(`/api/networks/${this.networkId}`);
  }

  /**
   * Generates a response from the network
   * @param params - Parameters for generation including input
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
   * Streams a response from the network
   * @param params - Parameters for streaming including input
   * @returns ReadableStream of network response chunks
   */
  async stream<T extends JSONSchema7 | ZodSchema | undefined = undefined>(params: StreamParams<T>): Promise<Response> {
    const processedParams = {
      ...params,
      output: params.output instanceof ZodSchema ? zodToJsonSchema(params.output) : params.output,
      experimental_output:
        params.experimental_output instanceof ZodSchema
          ? zodToJsonSchema(params.experimental_output)
          : params.experimental_output,
    };

    return await this.request<Response>(`/api/networks/${this.networkId}/stream`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });
  }
}
