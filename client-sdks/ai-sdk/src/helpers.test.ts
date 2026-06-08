import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { convertMastraChunkToAISDKv5 } from './helpers';

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
