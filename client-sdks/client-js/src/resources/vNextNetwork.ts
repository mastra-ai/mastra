import type { ClientOptions, GetVNextNetworkResponse, GenerateVNextNetworkResponse } from '../types';

import { BaseResource } from './base';

const RECORD_SEPARATOR = '\x1E';

export class VNextNetwork extends BaseResource {
  constructor(
    options: ClientOptions,
    private networkId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the network
   * @returns Promise containing vNext network details
   */
  details(): Promise<GetVNextNetworkResponse> {
    return this.request(`/api/networks/v-next/${this.networkId}`);
  }

  /**
   * Generates a response from the v-next network
   * @param params - Generation parameters including message
   * @returns Promise containing the generated response
   */
  generate(params: { message: string }): Promise<GenerateVNextNetworkResponse> {
    return this.request(`/api/networks/${this.networkId}/generate`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Streams a response from the v-next network
   * @param params - Stream parameters including message
   * @returns Promise containing the results
   */
  async stream(params: { message: string }) {
    const response: Response = await this.request(`/api/networks/v-next/${this.networkId}/stream`, {
      method: 'POST',
      body: { message: params.message },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream vNext network: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              try {
                const parsedChunk = JSON.parse(chunk);
                controller.enqueue(parsedChunk);
              } catch {
                // Silently ignore parsing errors
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
  }
}
