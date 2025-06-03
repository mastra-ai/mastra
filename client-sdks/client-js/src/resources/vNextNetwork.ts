import type { WatchEvent } from '@mastra/core/workflows';

import type {
  ClientOptions,
  GetVNextNetworkResponse,
  GenerateVNextNetworkResponse,
  LoopVNextNetworkResponse,
} from '../types';

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
   * Generates a response from the v-next network
   * @param params - Generation parameters including message
   * @returns Promise containing the generated response
   */
  loop(params: { message: string }): Promise<LoopVNextNetworkResponse> {
    return this.request(`/api/networks/${this.networkId}/loop`, {
      method: 'POST',
      body: params,
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
  async stream(params: { message: string }, onRecord: (record: WatchEvent) => void) {
    console.log('stream called');
    const response: Response = await this.request(`/api/networks/v-next/${this.networkId}/stream`, {
      method: 'POST',
      body: { message: params.message },
      stream: true,
    });

    console.log('after request');

    if (!response.ok) {
      throw new Error(`Failed to stream vNext network: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    console.log('request body gotten');

    // // Create a transform stream that processes the response body
    // const transformStream = new TransformStream({
    //   start() {
    //     console.log('starts stream');
    //   },
    //   async transform(chunk, controller) {
    //     console.log('beginning transform');
    //     try {
    //       console.log('transform starts===', chunk);
    //       // Decode binary data to text
    //       const decoded = new TextDecoder().decode(chunk);
    //       console.log('decoded===', decoded);

    //       // Split by record separator
    //       const chunks = decoded.split(RECORD_SEPARATOR);
    //       console.log('chunks===', chunk);

    //       // Process each chunk
    //       for (const chunk of chunks) {
    //         if (chunk) {
    //           try {
    //             const parsedChunk = JSON.parse(chunk);
    //             console.log('parsedchunk==', parsedChunk);
    //             controller.enqueue(parsedChunk);
    //           } catch (err) {
    //             console.log('error in chunk', err);
    //             // Silently ignore parsing errors
    //           }
    //         }
    //       }
    //     } catch (err) {
    //       console.log('transform error', err);
    //       // Silently ignore processing errors
    //     }
    //   },
    // });

    // console.log('transform stream created');

    // // Pipe the response body through the transform stream
    // return response.body.pipeThrough(transformStream);

    for await (const record of this.streamProcessor(response.body)) {
      if (typeof record === 'string') {
        onRecord(JSON.parse(record));
      } else {
        onRecord(record);
      }
    }
  }
}
