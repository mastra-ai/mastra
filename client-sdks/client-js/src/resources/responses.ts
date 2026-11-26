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
 * Returns the byte length of the line ending starting at `index` (`\r\n`, `\n` or `\r`), or 0.
 * `\r\n` is matched as a single ending so a CRLF pair is never read as two separate breaks.
 */
function matchLineEnding(text: string, index: number): number {
  if (text.startsWith('\r\n', index)) {
    return 2;
  }

  const char = text[index];
  return char === '\n' || char === '\r' ? 1 : 0;
}

/**
 * Locates the first blank-line event separator: any two adjacent line endings, so `\r\n\r\n`,
 * `\n\n`, `\r\r` and the mixed forms `\n\r\n`, `\n\r` and `\r\n\r` are all recognised. Scanning
 * for the earliest ending pair keeps mixed line endings from merging frames.
 *
 * A single ending is never a separator, so a buffer ending mid-CRLF (…`\r`) reports no boundary
 * and the caller waits for the next read. Once a second line ending is present the pair is a
 * complete blank line and is returned immediately, even when its last character is a `\r` that a
 * later read might extend to `\r\n`: two endings separate the frames either way, so holding it
 * back would stall a quiet CR-framed stream until more input or EOF arrives.
 */
function findSseBoundary(text: string): { index: number; length: number } | null {
  let index = 0;

  while (index < text.length) {
    const first = matchLineEnding(text, index);
    if (!first) {
      index += 1;
      continue;
    }

    const second = matchLineEnding(text, index + first);
    if (second) {
      return { index, length: first + second };
    }

    index += first;
  }

  return null;
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
