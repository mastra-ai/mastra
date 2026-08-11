import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import {
  convertMastraChunkToAISDKv5,
  convertMastraChunkToAISDKv6,
  convertFullStreamChunkToUIMessageStream,
} from './helpers';

describe('tool payload transform conversion', () => {
  it('uses display transforms for tool-call input', () => {
    const result = convertMastraChunkToAISDKv5({
      chunk: {
        type: 'tool-call',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              display: {
                'input-available': { transformed: { customerId: 'cus_123' } },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toEqual({ customerId: 'cus_123' });
  });

  it('uses separate display transforms for tool-result input and output', () => {
    const result = convertMastraChunkToAISDKv5({
      chunk: {
        type: 'tool-result',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
          result: { displayName: 'Acme', apiKey: 'secret-output' },
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              display: {
                'input-available': { transformed: { customerId: 'cus_123' } },
                'output-available': { transformed: { displayName: 'Acme' } },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toEqual({ customerId: 'cus_123' });
    expect(result.output).toEqual({ displayName: 'Acme' });
  });

  it('preserves explicit null display transforms', () => {
    const result = convertMastraChunkToAISDKv5({
      chunk: {
        type: 'tool-result',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
          result: { displayName: 'Acme', apiKey: 'secret-output' },
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              display: {
                'input-available': { transformed: null },
                'output-available': { transformed: null },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toBeNull();
    expect(result.output).toBeNull();
  });

  it('suppresses transformed input deltas marked as unsafe', () => {
    const result = convertMastraChunkToAISDKv5({
      chunk: {
        type: 'tool-call-delta',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          argsTextDelta: '{"apiKey":"secret',
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              display: {
                'input-delta': { suppress: true },
              },
            },
          },
        },
      },
    });

    expect(result).toBeUndefined();
  });

  it('uses transformed tool errors', () => {
    const result = convertMastraChunkToAISDKv5({
      chunk: {
        type: 'tool-error',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
          error: new Error('stack with /workspace/private/customer.json'),
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              display: {
                'input-available': { transformed: { customerId: 'cus_123' } },
                error: { transformed: { message: 'Tool failed' } },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toEqual({ customerId: 'cus_123' });
    expect(result.error).toEqual({ message: 'Tool failed' });
  });
});

describe('client observability carrier propagation', () => {
  it('preserves observability on tool-call and tool-input-start conversion', () => {
    const carrier = { traceparent: '00-cccccccccccccccccccccccccccccccc-dddddddddddddddd-01' };

    const toolCall = convertMastraChunkToAISDKv6({
      chunk: {
        type: 'tool-call',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'clientTool',
          args: {},
          observability: carrier,
        },
        metadata: {},
      } as any,
    }) as any;

    const toolInputStart = convertMastraChunkToAISDKv6({
      chunk: {
        type: 'tool-call-input-streaming-start',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-2',
          toolName: 'clientTool',
          observability: carrier,
        },
        metadata: {},
      } as any,
    }) as any;

    expect(toolCall.observability).toEqual(carrier);
    expect(toolInputStart.observability).toEqual(carrier);
  });

  it('maps tool-call observability onto v6 toolMetadata.__mastraObservability', () => {
    const carrier = { traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01' };

    const part = convertMastraChunkToAISDKv6({
      chunk: {
        type: 'tool-call',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call-1',
          toolName: 'clientTool',
          args: { a: 1 },
          observability: carrier,
        },
        metadata: {},
      } as any,
    }) as any;

    const uiChunk = convertFullStreamChunkToUIMessageStream({
      part,
      onError: err => (err instanceof Error ? err.message : String(err)),
    }) as any;

    expect(uiChunk).toMatchObject({
      type: 'tool-input-available',
      toolCallId: 'call-1',
      toolName: 'clientTool',
      toolMetadata: {
        __mastraObservability: carrier,
      },
    });
  });
});

describe('durable step-start with missing payload', () => {
  it('does not throw when a step-start chunk has no payload (@mastra/core >= 1.49)', () => {
    // @mastra/core >= 1.49 emits a durable `step-start` chunk with no `payload`.
    // The converter must not throw when destructuring it (regression: only the
    // `start` frame reached the client and the stream tore down).
    const chunk = { type: 'step-start', runId: 'run-1', from: ChunkFrom.AGENT } as any;
    expect(() => convertMastraChunkToAISDKv6({ chunk })).not.toThrow();
    expect((convertMastraChunkToAISDKv6({ chunk }) as any).type).toBe('start-step');
  });
});

describe('finish usage conversion', () => {
  const usage = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };

  it('converts canonical output usage', () => {
    const chunk = {
      type: 'finish',
      runId: 'run-1',
      from: ChunkFrom.AGENT,
      payload: { stepResult: { reason: 'stop' }, output: { usage } },
    } as any;

    expect(convertMastraChunkToAISDKv5({ chunk })).toMatchObject({
      type: 'finish',
      finishReason: 'stop',
      totalUsage: usage,
    });
  });

  it('converts legacy top-level usage retained by durable transports', () => {
    const chunk = {
      type: 'finish',
      runId: 'run-1',
      from: ChunkFrom.AGENT,
      payload: { stepResult: { reason: 'stop' }, usage },
    } as any;

    expect(convertMastraChunkToAISDKv5({ chunk })).toMatchObject({
      type: 'finish',
      finishReason: 'stop',
      totalUsage: usage,
    });
  });
});

describe('tool-output-denied chunk conversion (issue #20880)', () => {
  const chunk = {
    type: 'tool-output-denied' as const,
    runId: 'run-123',
    from: ChunkFrom.AGENT,
    payload: {
      toolCallId: 'tooluse_abc123',
      toolName: 'myTool',
      args: { param: 'value' },
      approval: { id: 'approval-1', approved: false as const, reason: 'Not allowed' },
    },
  };

  it('converts the Mastra denial to an AI SDK v6 stream part', () => {
    expect(convertMastraChunkToAISDKv6({ chunk, mode: 'stream' })).toEqual({
      type: 'tool-output-denied',
      toolCallId: 'tooluse_abc123',
      toolName: 'myTool',
    });
  });

  it('converts the stream part to an AI SDK UI message chunk', () => {
    expect(
      convertFullStreamChunkToUIMessageStream({
        part: {
          type: 'tool-output-denied',
          toolCallId: 'tooluse_abc123',
          toolName: 'myTool',
        },
        onError: String,
      }),
    ).toEqual({
      type: 'tool-output-denied',
      toolCallId: 'tooluse_abc123',
    });
  });
});

describe('finish reason on UI message chunks (issue #20562)', () => {
  const mastraFinishChunk = (reason: string) =>
    ({
      type: 'finish',
      runId: 'run-1',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason },
        output: { usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } },
      },
    }) as any;

  it('keeps the v6 finish reason on the terminal UI chunk', () => {
    const part = convertMastraChunkToAISDKv6({ chunk: mastraFinishChunk('content-filter') });

    expect(
      convertFullStreamChunkToUIMessageStream({
        part: part as any,
        sendFinish: true,
        onError: String,
      }),
    ).toEqual({ type: 'finish', finishReason: 'content-filter' });
  });

  it('reports the Mastra-only tripwire reason as other on the terminal UI chunk', () => {
    const part = convertMastraChunkToAISDKv6({ chunk: mastraFinishChunk('tripwire') });

    expect(
      convertFullStreamChunkToUIMessageStream({
        part: part as any,
        sendFinish: true,
        onError: String,
      }),
    ).toEqual({ type: 'finish', finishReason: 'other' });
  });

  it('keeps the v5 finish reason on the terminal UI chunk', () => {
    const part = convertMastraChunkToAISDKv5({ chunk: mastraFinishChunk('length') });

    expect(
      convertFullStreamChunkToUIMessageStream({
        part: part as any,
        sendFinish: true,
        messageMetadataValue: { custom: true },
        onError: String,
      }),
    ).toEqual({ type: 'finish', finishReason: 'length', messageMetadata: { custom: true } });
  });
});
