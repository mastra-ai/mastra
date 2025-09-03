import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { WatchEvent } from '@mastra/core/workflows';

import type {
  ClientOptions,
  GetVNextNetworkResponse,
  GenerateVNextNetworkResponse,
  LoopVNextNetworkResponse,
  GenerateOrStreamVNextNetworkParams,
  LoopStreamVNextNetworkParams,
} from '../types';

import { parseClientRuntimeContext } from '../utils';
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
  generate(params: GenerateOrStreamVNextNetworkParams): Promise<GenerateVNextNetworkResponse> {
    return this.request(`/api/networks/v-next/${this.networkId}/generate`, {
      method: 'POST',
      body: {
        ...params,
        runtimeContext: parseClientRuntimeContext(params.runtimeContext),
      },
    });
  }

  /**
   * Generates a response from the v-next network using multiple primitives
   * @param params - Generation parameters including message
   * @returns Promise containing the generated response
   */
  loop(params: {
    message: string;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<LoopVNextNetworkResponse> {
    return this.request(`/api/networks/v-next/${this.networkId}/loop`, {
      method: 'POST',
      body: {
        ...params,
        runtimeContext: parseClientRuntimeContext(params.runtimeContext),
      },
    });
  }

  private async *streamProcessor(stream: ReadableStream): AsyncGenerator<WatchEvent, void, unknown> {
    const reader = stream.getReader();

    // Track if we've finished reading from the stream
    let doneReading = false;
    // Buffer to accumulate partial chunks
    let buffer = '';

    try {
      while (!doneReading) {
        // Read the next chunk from the stream
        const { done, value } = await reader.read();
        doneReading = done;

        // Skip processing if we're done and there's no value
        if (done && !value) continue;

        try {
          // Decode binary data to text
          const decoded = value ? new TextDecoder().decode(value) : '';

          // Split the combined buffer and new data by record separator
          const chunks = (buffer + decoded).split(RECORD_SEPARATOR);

          // The last chunk might be incomplete, so save it for the next iteration
          buffer = chunks.pop() || '';

          // Process complete chunks
          for (const chunk of chunks) {
            if (chunk) {
              // Only process non-empty chunks
              if (typeof chunk === 'string') {
                try {
                  const parsedChunk = JSON.parse(chunk);
                  yield parsedChunk;
                } catch {
                  // Silently ignore parsing errors to maintain stream processing
                  // This allows the stream to continue even if one record is malformed
                }
              }
            }
          }
        } catch {
          // Silently ignore parsing errors to maintain stream processing
          // This allows the stream to continue even if one record is malformed
        }
      }

      // Process any remaining data in the buffer after stream is done
      if (buffer) {
        try {
          yield JSON.parse(buffer);
        } catch {
          // Ignore parsing error for final chunk
        }
      }
    } finally {
      // Always ensure we clean up the reader
      reader.cancel().catch(() => {
        // Ignore cancel errors
      });
    }
  }

  /**
   * Streams a response from the v-next network
   * @param params - Stream parameters including message
   * @returns Promise containing the results
   */
  async stream(params: GenerateOrStreamVNextNetworkParams, onRecord: (record: WatchEvent) => void) {
    const response: Response = await this.request(`/api/networks/v-next/${this.networkId}/stream`, {
      method: 'POST',
      body: {
        ...params,
        runtimeContext: parseClientRuntimeContext(params.runtimeContext),
      },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream vNext network: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    for await (const record of this.streamProcessor(response.body)) {
      if (typeof record === 'string') {
        onRecord(JSON.parse(record));
      } else {
        onRecord(record);
      }
    }
  }

  /**
   * Streams a response from the v-next network loop
   * @param params - Stream parameters including message
   * @returns Promise containing the results
   */
  async loopStream(params: LoopStreamVNextNetworkParams, onRecord: (record: WatchEvent) => void) {
    const response: Response = await this.request(`/api/networks/v-next/${this.networkId}/loop-stream`, {
      method: 'POST',
      body: {
        ...params,
        runtimeContext: parseClientRuntimeContext(params.runtimeContext),
      },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream vNext network loop: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    for await (const record of this.streamProcessor(response.body)) {
      if (typeof record === 'string') {
        onRecord(JSON.parse(record));
      } else {
        onRecord(record);
      }
    }
  }
}
