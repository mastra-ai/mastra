import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraClient } from '../client';

global.fetch = vi.fn();

const clientOptions = {
  baseUrl: 'http://localhost:4111',
  headers: {
    Authorization: 'Bearer test-key',
  },
};

function mockJsonResponse(data: unknown) {
  const response = new Response(undefined, {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  });

  response.json = () => Promise.resolve(data);
  (global.fetch as any).mockResolvedValueOnce(response);
}

function mockSseResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

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
