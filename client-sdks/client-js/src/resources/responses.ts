import type { RequestContext } from '@mastra/core/request-context';
import type {
  ClientOptions,
  CreateResponseParams,
  ResponseOutputMessage,
  ResponsesDeleteResponse,
  ResponsesResponse,
  ResponsesStreamEvent,
} from '../types';
import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

type ResponsePayload = Omit<ResponsesResponse, 'output_text'>;

function getOutputText(output: ResponseOutputMessage[]): string {
  return output
    .flatMap(message => message.content)
    .map(part => part.text)
    .join('');
}

function attachOutputText(response: ResponsePayload): ResponsesResponse {
  return {
    ...response,
    output_text: getOutputText(response.output),
  };
}

function hydrateStreamEvent(event: ResponsesStreamEvent | ResponsePayload): ResponsesStreamEvent | ResponsesResponse {
  if (
    typeof event === 'object' &&
    event !== null &&
    'response' in event &&
    (event.type === 'response.created' || event.type === 'response.completed')
  ) {
    return {
      ...event,
      response: attachOutputText(event.response as ResponsePayload),
    } as ResponsesStreamEvent;
  }

  if (typeof event === 'object' && event !== null && 'output' in event) {
    return attachOutputText(event as ResponsePayload);
  }

  return event as ResponsesStreamEvent;
}

function parseSseBlock(block: string): ResponsesStreamEvent | null {
  const normalizedBlock = block.replace(/\r\n/g, '\n').trim();
  if (!normalizedBlock) {
    return null;
  }

  const dataLines = normalizedBlock
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim());

  if (!dataLines.length) {
    return null;
  }

  const data = dataLines.join('\n');
  if (data === '[DONE]') {
    return null;
  }

  return hydrateStreamEvent(JSON.parse(data)) as ResponsesStreamEvent;
}

export class ResponsesStream implements AsyncIterable<ResponsesStreamEvent> {
  constructor(private response: Response) {}

  asResponse(): Response {
    return this.response;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<ResponsesStreamEvent> {
    if (!this.response.body) {
      return;
    }

    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const block = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);

          const parsed = parseSseBlock(block);
          if (parsed) {
            yield parsed;
          }

          boundaryIndex = buffer.indexOf('\n\n');
        }

        if (done) {
          break;
        }
      }

      const finalEvent = parseSseBlock(buffer);
      if (finalEvent) {
        yield finalEvent;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class Responses extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  async create(params: CreateResponseParams & { stream: true }): Promise<ResponsesStream>;
  async create(params: CreateResponseParams & { stream?: false | undefined }): Promise<ResponsesResponse>;
  async create(params: CreateResponseParams): Promise<ResponsesResponse | ResponsesStream> {
    const { requestContext, ...body } = params;
    const path = `/v1/responses${requestContextQueryString(requestContext)}`;

    if (params.stream) {
      const response = await this.request<Response>(path, {
        method: 'POST',
        body,
        stream: true,
      });

      return new ResponsesStream(response);
    }

    const response = await this.request<ResponsePayload>(path, {
      method: 'POST',
      body,
    });

    return attachOutputText(response);
  }

  async retrieve(
    responseId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ResponsesResponse> {
    const response = await this.request<ResponsePayload>(
      `/v1/responses/${encodeURIComponent(responseId)}${requestContextQueryString(requestContext)}`,
    );

    return attachOutputText(response);
  }

  del(responseId: string, requestContext?: RequestContext | Record<string, any>): Promise<ResponsesDeleteResponse> {
    return this.request(`/v1/responses/${encodeURIComponent(responseId)}${requestContextQueryString(requestContext)}`, {
      method: 'DELETE',
    });
  }
}
