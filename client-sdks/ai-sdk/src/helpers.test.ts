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

describe('background-task chunk passthrough', () => {
  it('surfaces background-task-started as a data-* UI part with the structured payload', () => {
    // Mirror the agent-stream flow: convertMastraChunkToAISDK flattens the chunk,
    // then convertFullStreamChunkToUIMessageStream maps it to a UI part.
    const part = convertMastraChunkToAISDKv6({
      chunk: {
        type: 'background-task-started',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          taskId: 'task-123',
          toolName: 'deepResearch',
          toolCallId: 'call-1',
        },
      } as any,
    }) as any;

    const uiChunk = convertFullStreamChunkToUIMessageStream({
      part,
      onError: err => (err instanceof Error ? err.message : String(err)),
    }) as any;

    expect(uiChunk).toEqual({
      type: 'data-background-task-started',
      id: 'call-1',
      data: {
        taskId: 'task-123',
        toolName: 'deepResearch',
        toolCallId: 'call-1',
      },
    });
  });

  it('passes through other background-task-* lifecycle chunks as data parts', () => {
    const uiChunk = convertFullStreamChunkToUIMessageStream({
      part: { type: 'background-task-failed', taskId: 'task-9', toolCallId: 'call-9', error: 'boom' } as any,
      onError: err => (err instanceof Error ? err.message : String(err)),
    }) as any;

    expect(uiChunk).toEqual({
      type: 'data-background-task-failed',
      id: 'call-9',
      data: { taskId: 'task-9', toolCallId: 'call-9', error: 'boom' },
    });
  });
});
