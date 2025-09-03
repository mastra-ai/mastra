import { processDataStream } from '@ai-sdk/ui-utils';
import type { GenerateReturn } from '@mastra/core/llm';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';
import type { GenerateParams, ClientOptions, StreamParams, GetNetworkResponse } from '../types';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';

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
  generate<
    Output extends JSONSchema7 | ZodSchema | undefined = undefined,
    StructuredOutput extends JSONSchema7 | ZodSchema | undefined = undefined,
  >(params: GenerateParams<Output>): Promise<GenerateReturn<any, Output, StructuredOutput>> {
    const processedParams = {
      ...params,
      output: zodToJsonSchema(params.output),
      experimental_output: zodToJsonSchema(params.experimental_output),
    };

    return this.request(`/api/networks/${this.networkId}/generate`, {
      method: 'POST',
      body: processedParams,
    });
  }

  /**
   * Streams a response from the agent
   * @param params - Stream parameters including prompt
   * @returns Promise containing the enhanced Response object with processDataStream method
   */
  async stream<T extends JSONSchema7 | ZodSchema | undefined = undefined>(
    params: StreamParams<T>,
  ): Promise<
    Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    }
  > {
    const processedParams = {
      ...params,
      output: zodToJsonSchema(params.output),
      experimental_output: zodToJsonSchema(params.experimental_output),
    };

    const response: Response & {
      processDataStream: (options?: Omit<Parameters<typeof processDataStream>[0], 'stream'>) => Promise<void>;
    } = await this.request(`/api/networks/${this.networkId}/stream`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    response.processDataStream = async (options = {}) => {
      await processDataStream({
        stream: response.body as ReadableStream<Uint8Array>,
        ...options,
      });
    };

    return response;
  }
}
