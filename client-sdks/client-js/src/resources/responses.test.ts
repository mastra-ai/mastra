import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type {
  ResponsesCompletedEvent,
  ResponsesOutputTextDeltaEvent,
  ResponsesResponse,
  ResponsesStreamEvent,
} from '../types';

global.fetch = vi.fn();

const clientOptions = {
  baseUrl: 'http://localhost:4111',
  headers: {
    Authorization: 'Bearer test-key',
  },
};

function mockJsonResponse(data: unknown) {
  const response = new Response(JSON.stringify(data), {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  });
  (global.fetch as any).mockResolvedValueOnce(response);
}

/** Wire shape of a `response.completed` event: `output_text` is derived client-side, not sent. */
type WireCompletedEvent = Omit<ResponsesCompletedEvent, 'response'> & {
  response: Omit<ResponsesResponse, 'output_text'>;
};

const textDeltaEvent: ResponsesOutputTextDeltaEvent = {
  type: 'response.output_text.delta',
  sequence_number: 1,
  output_index: 0,
  content_index: 0,
  item_id: 'msg_123',
  delta: 'Hello',
};

function buildCompletedEvent(): WireCompletedEvent {
  return {
    type: 'response.completed',
    sequence_number: 2,
    response: {
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'support-agent',
      status: 'completed',
      output: [
        {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello world' }],
        },
      ],
      usage: null,
      instructions: null,
      previous_response_id: null,
      store: false,
    },
  };
}

type SseMockOptions = {
  /** Blank-line event separator placed between `data:` records. Defaults to LF (`\n\n`). */
  delimiter?: string;
  /** When set, the wire payload is enqueued in fixed-size byte slices instead of one chunk. */
  chunkSize?: number;
};

function encodeSsePayload(events: unknown[], delimiter = '\n\n'): Uint8Array {
  const payload = events.map(event => `data: ${JSON.stringify(event)}`).join(delimiter) + delimiter;
  return new TextEncoder().encode(payload);
}

function streamFromBytes(bytes: Uint8Array, chunkSize?: number): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (chunkSize && chunkSize > 0) {
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
        }
      } else {
        controller.enqueue(bytes);
      }
      controller.close();
    },
  });
}

function mockStreamResponse(body: ReadableStream<Uint8Array>) {
  (global.fetch as any).mockResolvedValueOnce(
    new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'text/event-stream',
      }),
    }),
  );
}

function mockSseResponse(events: unknown[], options: SseMockOptions = {}) {
  const { delimiter = '\n\n', chunkSize } = options;
  mockStreamResponse(streamFromBytes(encodeSsePayload(events, delimiter), chunkSize));
}

/** Mocks a stream with a hand-built wire payload, for mixed delimiters and multi-line `data:`. */
function mockRawSseResponse(payload: string, options: { chunkSize?: number } = {}) {
  const bytes = new TextEncoder().encode(payload);
  mockStreamResponse(streamFromBytes(bytes, options.chunkSize));
}

/** Mocks an open SSE stream and returns its controller so a test can enqueue after a pending read. */
function mockOpenSseStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  mockStreamResponse(body);
  return controller;
}

/** Bounds a stream read so an unfixed parser fails with a clear message instead of hanging the suite. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms waiting for ${label}`)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

async function collectEvents(stream: AsyncIterable<ResponsesStreamEvent>): Promise<ResponsesStreamEvent[]> {
  const events: ResponsesStreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe('Responses Resource', () => {
  let client: MastraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('creates a non-streaming response with output_text convenience', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'support-agent',
      status: 'completed',
      output: [
        {
          id: 'call_123',
          type: 'function_call',
          call_id: 'call_123',
          name: 'weather',
          arguments: '{"city":"Lagos"}',
          status: 'completed',
        },
        {
          id: 'call_123_output',
          type: 'function_call_output',
          call_id: 'call_123',
          output: '{"weather":"sunny"}',
        },
        {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello from Mastra' }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
      conversation_id: 'conv_123',
      providerOptions: {
        openai: {
          responseId: 'resp_provider_123',
        },
      },
      instructions: null,
      previous_response_id: null,
      store: true,
    });

    const response = await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Summarize this ticket',
      store: true,
    });

    expect(response.output_text).toBe('Hello from Mastra');
    expect(response.conversation_id).toBe('conv_123');
    expect(response.providerOptions).toEqual({
      openai: {
        responseId: 'resp_provider_123',
      },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
        body: JSON.stringify({
          model: 'openai/gpt-5',
          agent_id: 'support-agent',
          input: 'Summarize this ticket',
          store: true,
        }),
      }),
    );
  });

  it('allows create requests without a model override', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'openai/gpt-5',
      status: 'completed',
      output: [
        {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello from Mastra' }],
        },
      ],
      usage: null,
      instructions: null,
      previous_response_id: null,
      store: false,
    });

    const response = await client.responses.create({
      agent_id: 'support-agent',
      input: 'Summarize this ticket',
    });

    expect(response.model).toBe('openai/gpt-5');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
        body: JSON.stringify({
          agent_id: 'support-agent',
          input: 'Summarize this ticket',
        }),
      }),
    );
  });

  it('passes providerOptions through in create requests', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'openai/gpt-5',
      status: 'completed',
      output: [],
      usage: null,
      instructions: null,
      previous_response_id: null,
      store: false,
    });

    await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Continue this',
      providerOptions: {
        openai: {
          previousResponseId: 'resp_provider_123',
        },
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'openai/gpt-5',
          agent_id: 'support-agent',
          input: 'Continue this',
          providerOptions: {
            openai: {
              previousResponseId: 'resp_provider_123',
            },
          },
        }),
      }),
    );
  });

  it('passes text.format through in create requests', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'openai/gpt-5',
      status: 'completed',
      output: [],
      usage: null,
      instructions: null,
      previous_response_id: null,
      store: false,
    });

    await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Return JSON',
      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'openai/gpt-5',
          agent_id: 'support-agent',
          input: 'Return JSON',
          text: {
            format: {
              type: 'json_object',
            },
          },
        }),
      }),
    );
  });

  it('passes json_schema text.format through in create requests', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'openai/gpt-5',
      status: 'completed',
      output: [],
      usage: null,
      instructions: null,
      text: {
        format: {
          type: 'json_schema',
          name: 'ticket_summary',
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
            },
            required: ['summary'],
          },
        },
      },
      previous_response_id: null,
      store: false,
    });

    await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Return typed JSON',
      text: {
        format: {
          type: 'json_schema',
          name: 'ticket_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
            },
            required: ['summary'],
          },
        },
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'openai/gpt-5',
          agent_id: 'support-agent',
          input: 'Return typed JSON',
          text: {
            format: {
              type: 'json_schema',
              name: 'ticket_summary',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                },
                required: ['summary'],
              },
            },
          },
        }),
      }),
    );
  });

  it('streams response events as an async iterable', async () => {
    mockSseResponse([
      {
        type: 'response.created',
        sequence_number: 1,
        response: {
          id: 'resp_123',
          object: 'response',
          created_at: 1234567890,
          model: 'support-agent',
          status: 'in_progress',
          output: [],
          usage: null,
          instructions: null,
          previous_response_id: null,
          store: false,
        },
      },
      {
        type: 'response.in_progress',
        sequence_number: 2,
        response: {
          id: 'resp_123',
          object: 'response',
          created_at: 1234567890,
          model: 'support-agent',
          status: 'in_progress',
          output: [],
          usage: null,
          instructions: null,
          previous_response_id: null,
          store: false,
        },
      },
      {
        type: 'response.output_item.added',
        sequence_number: 3,
        output_index: 0,
        item: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'in_progress',
          content: [],
        },
      },
      {
        type: 'response.content_part.added',
        sequence_number: 4,
        output_index: 0,
        content_index: 0,
        item_id: 'msg_123',
        part: {
          type: 'output_text',
          text: '',
          annotations: [],
          logprobs: [],
        },
      },
      {
        type: 'response.output_text.delta',
        sequence_number: 5,
        output_index: 0,
        content_index: 0,
        item_id: 'msg_123',
        delta: 'Hello',
      },
      {
        type: 'response.output_text.done',
        sequence_number: 6,
        output_index: 0,
        content_index: 0,
        item_id: 'msg_123',
        text: 'Hello world',
      },
      {
        type: 'response.content_part.done',
        sequence_number: 7,
        output_index: 0,
        content_index: 0,
        item_id: 'msg_123',
        part: {
          type: 'output_text',
          text: 'Hello world',
          annotations: [],
          logprobs: [],
        },
      },
      {
        type: 'response.output_item.done',
        sequence_number: 8,
        output_index: 0,
        item: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello world', annotations: [], logprobs: [] }],
        },
      },
      {
        type: 'response.completed',
        sequence_number: 9,
        response: {
          id: 'resp_123',
          object: 'response',
          created_at: 1234567890,
          model: 'support-agent',
          status: 'completed',
          output: [
            {
              id: 'msg_123',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text: 'Hello world' }],
            },
          ],
          usage: {
            input_tokens: 12,
            output_tokens: 4,
            total_tokens: 16,
          },
          instructions: null,
          previous_response_id: null,
          store: false,
        },
      },
    ]);

    const stream = await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Say hello',
      stream: true,
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(9);
    expect(events[0]).toMatchObject({
      type: 'response.created',
      sequence_number: 1,
      response: {
        output_text: '',
      },
    });
    expect(events[1]).toMatchObject({
      type: 'response.in_progress',
      sequence_number: 2,
      response: {
        output_text: '',
      },
    });
    expect(events[2]).toMatchObject({
      type: 'response.output_item.added',
      sequence_number: 3,
    });
    expect(events[3]).toMatchObject({
      type: 'response.content_part.added',
      sequence_number: 4,
    });
    expect(events[4]).toMatchObject({
      type: 'response.output_text.delta',
      sequence_number: 5,
      delta: 'Hello',
    });
    expect(events[5]).toMatchObject({
      type: 'response.output_text.done',
      sequence_number: 6,
      text: 'Hello world',
    });
    expect(events[6]).toMatchObject({
      type: 'response.content_part.done',
      sequence_number: 7,
      part: {
        text: 'Hello world',
      },
    });
    expect(events[7]).toMatchObject({
      type: 'response.output_item.done',
      sequence_number: 8,
      item: {
        content: [{ text: 'Hello world' }],
      },
    });
    expect(events[8]).toMatchObject({
      type: 'response.completed',
      sequence_number: 9,
      response: {
        output_text: 'Hello world',
      },
    });
  });

  it('provides a stream helper with OpenAI-style naming', async () => {
    mockSseResponse([
      {
        type: 'response.completed',
        sequence_number: 1,
        response: {
          id: 'resp_123',
          object: 'response',
          created_at: 1234567890,
          model: 'support-agent',
          status: 'completed',
          output: [
            {
              id: 'msg_123',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text: 'Hello world' }],
            },
          ],
          usage: null,
          instructions: null,
          previous_response_id: null,
          store: false,
        },
      },
    ]);

    const stream = await client.responses.stream({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Say hello',
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'response.completed',
      sequence_number: 1,
      response: {
        output_text: 'Hello world',
      },
    });
  });

  it('preserves non-message output items in stream events', async () => {
    mockSseResponse([
      {
        type: 'response.output_item.done',
        sequence_number: 1,
        output_index: 0,
        item: {
          id: 'call_123',
          type: 'function_call',
          call_id: 'call_123',
          name: 'weather',
          arguments: '{"city":"Lagos"}',
          status: 'completed',
        },
      },
    ]);

    const stream = await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Use the weather tool',
      stream: true,
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'response.output_item.done',
        sequence_number: 1,
        output_index: 0,
        item: {
          id: 'call_123',
          type: 'function_call',
          call_id: 'call_123',
          name: 'weather',
          arguments: '{"city":"Lagos"}',
          status: 'completed',
        },
      },
    ]);
  });

  it('preserves streamed function-call argument events', async () => {
    mockSseResponse([
      {
        type: 'response.function_call_arguments.delta',
        sequence_number: 1,
        output_index: 0,
        item_id: 'call_123',
        delta: '{"city":',
      },
      {
        type: 'response.function_call_arguments.done',
        sequence_number: 2,
        output_index: 0,
        item_id: 'call_123',
        name: 'weather',
        arguments: '{"city":"Lagos"}',
      },
    ]);

    const stream = await client.responses.create({
      model: 'openai/gpt-5',
      agent_id: 'support-agent',
      input: 'Use the weather tool',
      stream: true,
    });

    const events: ResponsesStreamEvent[] = [];
    for await (const event of stream) {
      events.push(event);
    }

    const doneEvent = events.find(
      (event): event is Extract<ResponsesStreamEvent, { type: 'response.function_call_arguments.done' }> =>
        event.type === 'response.function_call_arguments.done',
    );
    expect(doneEvent?.arguments).toBe('{"city":"Lagos"}');
    expect(events).toEqual([
      {
        type: 'response.function_call_arguments.delta',
        sequence_number: 1,
        output_index: 0,
        item_id: 'call_123',
        delta: '{"city":',
      },
      {
        type: 'response.function_call_arguments.done',
        sequence_number: 2,
        output_index: 0,
        item_id: 'call_123',
        name: 'weather',
        arguments: '{"city":"Lagos"}',
      },
    ]);
  });

  describe('SSE frame boundaries', () => {
    const delimiters: Array<{ name: string; delimiter: string }> = [
      { name: 'LF', delimiter: '\n\n' },
      { name: 'CRLF', delimiter: '\r\n\r\n' },
      { name: 'CR', delimiter: '\r\r' },
    ];

    // Technical: blank-line framing in `\r\n\r\n`, `\n\n`, or `\r\r` must yield each event
    // separately instead of merging frames until EOF. (#31000)
    it.each(delimiters)('emits separate events for $name framing', async ({ delimiter }) => {
      mockSseResponse([textDeltaEvent, buildCompletedEvent()], { delimiter });

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'response.output_text.delta',
        sequence_number: 1,
        delta: 'Hello',
      });
      expect(events[1]).toMatchObject({
        type: 'response.completed',
        sequence_number: 2,
        response: { output_text: 'Hello world' },
      });
    });

    // A CRLF, LF or CR ending may sit next to any other, so `\n\r\n`, `\n\r` and `\r\n\r` are
    // also valid blank-line frame breaks. (#31000)
    const mixedDelimiters: Array<{ name: string; delimiter: string }> = [
      { name: 'LF then CRLF', delimiter: '\n\r\n' },
      { name: 'LF then CR', delimiter: '\n\r' },
      { name: 'CRLF then CR', delimiter: '\r\n\r' },
    ];

    function mixedDelimiterPayload(delimiter: string): string {
      return `data: ${JSON.stringify(textDeltaEvent)}${delimiter}data: ${JSON.stringify(buildCompletedEvent())}`;
    }

    it.each(mixedDelimiters)('parses $name framing in coalesced chunks', async ({ delimiter }) => {
      mockRawSseResponse(mixedDelimiterPayload(delimiter));

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events.map(event => event.type)).toEqual(['response.output_text.delta', 'response.completed']);
      expect(events[0]).toMatchObject({ delta: 'Hello' });
      expect(events[1]).toMatchObject({ response: { output_text: 'Hello world' } });
    });

    it.each(mixedDelimiters)('parses $name framing one byte at a time', async ({ delimiter }) => {
      mockRawSseResponse(mixedDelimiterPayload(delimiter), { chunkSize: 1 });

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events.map(event => event.type)).toEqual(['response.output_text.delta', 'response.completed']);
      expect(events[0]).toMatchObject({ delta: 'Hello' });
      expect(events[1]).toMatchObject({ response: { output_text: 'Hello world' } });
    });

    it('chooses the earliest boundary when delimiters are mixed', async () => {
      // Three events framed CRLF, then CR, then LF. Any parser that prefers one delimiter
      // form globally merges the earlier frames into one `JSON.parse` and fails. (#31000)
      mockRawSseResponse(
        `data: ${JSON.stringify(textDeltaEvent)}\r\n\r\ndata: ${JSON.stringify(buildCompletedEvent())}\r\r`,
      );

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events.map(event => event.type)).toEqual(['response.output_text.delta', 'response.completed']);
      expect(events[0]).toMatchObject({ delta: 'Hello' });
      expect(events[1]).toMatchObject({ response: { output_text: 'Hello world' } });
    });

    it('parses CRLF-framed events that arrive one byte at a time', async () => {
      // The issue: CR and LF arrive in separate reads, so a partial CRLF must not be
      // consumed as a complete boundary. (#31000)
      mockSseResponse([textDeltaEvent, buildCompletedEvent()], { delimiter: '\r\n\r\n', chunkSize: 1 });

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ type: 'response.output_text.delta', delta: 'Hello' });
      expect(events[1]).toMatchObject({ type: 'response.completed', response: { output_text: 'Hello world' } });
    });

    it('joins multi-line data within a CRLF-framed event', async () => {
      const firstLine = `{"type":"response.output_text.delta","sequence_number":1,"output_index":0,`;
      const secondLine = `"content_index":0,"item_id":"msg_123","delta":"Hello"}`;
      mockRawSseResponse(
        `data: ${firstLine}\r\ndata: ${secondLine}\r\n\r\ndata: ${JSON.stringify(buildCompletedEvent())}\r\n\r\n`,
      );

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ type: 'response.output_text.delta', delta: 'Hello' });
      expect(events[1]).toMatchObject({ type: 'response.completed', response: { output_text: 'Hello world' } });
    });

    it('parses a final event that arrives without a trailing delimiter at EOF', async () => {
      mockRawSseResponse(
        `data: ${JSON.stringify(textDeltaEvent)}\r\n\r\ndata: ${JSON.stringify(buildCompletedEvent())}`,
      );

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });

      const events = await collectEvents(stream);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ type: 'response.output_text.delta', delta: 'Hello' });
      expect(events[1]).toMatchObject({ type: 'response.completed', response: { output_text: 'Hello world' } });
    });

    it('emits a complete CRLF event before the stream ends', async () => {
      const controller = mockOpenSseStream();
      const encoder = new TextEncoder();

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });
      const iterator = stream[Symbol.asyncIterator]();

      try {
        const first = iterator.next();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(textDeltaEvent)}\r\n\r\n`));

        const firstResult = await withTimeout(first, 2000, 'first stream event');
        expect(firstResult.done).toBe(false);
        expect(firstResult.value).toMatchObject({
          type: 'response.output_text.delta',
          sequence_number: 1,
          delta: 'Hello',
        });

        const second = iterator.next();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(buildCompletedEvent())}\r\n\r\n`));
        controller.close();

        const secondResult = await withTimeout(second, 2000, 'second stream event');
        expect(secondResult.done).toBe(false);
        expect(secondResult.value).toMatchObject({
          type: 'response.completed',
          response: { output_text: 'Hello world' },
        });

        const done = await withTimeout(iterator.next(), 2000, 'stream completion');
        expect(done.done).toBe(true);
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
        await iterator.return?.();
      }
    });

    it('emits a complete CR-framed event before the stream ends', async () => {
      // A blank line of two bare carriage returns must be emitted as soon as the second CR
      // arrives; holding it back in case that CR becomes a CRLF stalls a quiet CR-framed
      // stream indefinitely. (#31000)
      const controller = mockOpenSseStream();
      const encoder = new TextEncoder();

      const stream = await client.responses.create({
        model: 'openai/gpt-5',
        agent_id: 'support-agent',
        input: 'Say hello',
        stream: true,
      });
      const iterator = stream[Symbol.asyncIterator]();

      try {
        const first = iterator.next();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(textDeltaEvent)}\r\r`));

        const firstResult = await withTimeout(first, 2000, 'first CR-framed stream event');
        expect(firstResult.done).toBe(false);
        expect(firstResult.value).toMatchObject({
          type: 'response.output_text.delta',
          sequence_number: 1,
          delta: 'Hello',
        });

        const second = iterator.next();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(buildCompletedEvent())}\r\r`));

        const secondResult = await withTimeout(second, 2000, 'second CR-framed stream event');
        expect(secondResult.done).toBe(false);
        expect(secondResult.value).toMatchObject({
          type: 'response.completed',
          response: { output_text: 'Hello world' },
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
        await iterator.return?.();
      }
    });
  });

  it('retrieves a stored response', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      created_at: 1234567890,
      model: 'support-agent',
      status: 'completed',
      output: [
        {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Stored response' }],
        },
      ],
      usage: null,
      instructions: null,
      previous_response_id: null,
      store: true,
    });

    const response = await client.responses.retrieve('resp_123');

    expect(response.output_text).toBe('Stored response');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses/resp_123',
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('deletes a stored response', async () => {
    mockJsonResponse({
      id: 'resp_123',
      object: 'response',
      deleted: true,
    });

    const response = await client.responses.delete('resp_123');

    expect(response).toEqual({
      id: 'resp_123',
      object: 'response',
      deleted: true,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/v1/responses/resp_123',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});
