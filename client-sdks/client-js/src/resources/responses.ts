import type { RequestContext } from '@mastra/core/request-context';
import type { PathParams } from '../route-types.generated.js';
import type {
  ClientOptions,
  CreateResponseParams,
  ResponseOutputItem,
  ResponsesDeleteResponse,
  ResponsesResponse,
  ResponsesStreamEvent,
} from '../types';
import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

type ResponseId = PathParams<'GET /v1/responses/:responseId'>['responseId'];
type ResponsePayload = Omit<ResponsesResponse, 'output_text'>;

function getOutputText(output: ResponseOutputItem[]): string {
  return output
    .flatMap(item => (item.type === 'message' ? item.content : []))
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('');
}

function attachOutputText(response: ResponsePayload): ResponsesResponse {
  return {
    ...response,
    output_text: getOutputText(response.output),
  };
}

function hydrateOutputItem(item: ResponseOutputItem): ResponseOutputItem {
  if (item.type !== 'message') {
    return item;
  }

  return {
    ...item,
    content: item.content ?? [],
  };
}

function hydrateStreamEvent(event: ResponsesStreamEvent | ResponsePayload): ResponsesStreamEvent | ResponsesResponse {
  if (
    typeof event === 'object' &&
    event !== null &&
    'response' in event &&
    (event.type === 'response.created' || event.type === 'response.in_progress' || event.type === 'response.completed')
  ) {
    return {
      ...event,
      response: attachOutputText(event.response as ResponsePayload),
    } as ResponsesStreamEvent;
  }

  if (typeof event === 'object' && event !== null && 'output' in event) {
    return attachOutputText(event);
  }

  if (
    typeof event === 'object' &&
    event !== null &&
    'item' in event &&
    (event.type === 'response.output_item.added' || event.type === 'response.output_item.done')
  ) {
    return {
      ...event,
      item: hydrateOutputItem(event.item),
    } as ResponsesStreamEvent;
  }

  return event as ResponsesStreamEvent;
}

function parseSseBlock(block: string): ResponsesStreamEvent | null {
  const trimmedBlock = block.trim();
  if (!trimmedBlock) {
    return null;
  }

  const dataLines = trimmedBlock
    .split(/\r\n|\n|\r/)
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

/**
 * Locates the first blank-line event separator, accepting `\r\n\r\n`, `\n\n` or `\r\r`.
 * Returns the earliest match so mixed line endings cannot merge frames; the caller must
 * wait for more input when none is found rather than guessing a partial boundary.
 */
function findSseBoundary(text: string): { index: number; length: number } | null {
  const candidates = [
    { index: text.indexOf('\r\n\r\n'), length: 4 },
    { index: text.indexOf('\n\n'), length: 2 },
    { index: text.indexOf('\r\r'), length: 2 },
  ].filter(candidate => candidate.index !== -1);

  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((earliest, candidate) => (candidate.index < earliest.index ? candidate : earliest));
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
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        let boundary = findSseBoundary(buffer);
        while (boundary) {
          const block = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary.length);

          const parsed = parseSseBlock(block);
          if (parsed) {
            yield parsed;
          }

          boundary = findSseBoundary(buffer);
        }

        if (done) {
          break;
        }
      }

      const finalEvent = parseSseBlock(buffer);
      completed = true;
      if (finalEvent) {
        yield finalEvent;
      }
    } finally {
      if (!completed) {
        await reader.cancel();
      }
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

  stream(params: Omit<CreateResponseParams, 'stream'>): Promise<ResponsesStream> {
    return this.create({ ...params, stream: true });
  }

  async retrieve(
    responseId: ResponseId,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ResponsesResponse> {
    const response = await this.request<ResponsePayload>(
      `/v1/responses/${encodeURIComponent(responseId)}${requestContextQueryString(requestContext)}`,
    );

    return attachOutputText(response);
  }

  delete(
    responseId: ResponseId,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ResponsesDeleteResponse> {
    return this.request(`/v1/responses/${encodeURIComponent(responseId)}${requestContextQueryString(requestContext)}`, {
      method: 'DELETE',
    });
  }
}
