import { ChunkFrom } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { convertMastraChunkToAISDKv5 } from './helpers';

describe('tool payload projection conversion', () => {
  it('uses display projections for tool-call input', () => {
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
            toolPayloadProjection: {
              display: {
                'input-available': { projected: { customerId: 'cus_123' } },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toEqual({ customerId: 'cus_123' });
  });

  it('uses separate display projections for tool-result input and output', () => {
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
            toolPayloadProjection: {
              display: {
                'input-available': { projected: { customerId: 'cus_123' } },
                'output-available': { projected: { displayName: 'Acme' } },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toEqual({ customerId: 'cus_123' });
    expect(result.output).toEqual({ displayName: 'Acme' });
  });

  it('preserves explicit null display projections', () => {
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
            toolPayloadProjection: {
              display: {
                'input-available': { projected: null },
                'output-available': { projected: null },
              },
            },
          },
        },
      },
    }) as any;

    expect(result.input).toBeNull();
    expect(result.output).toBeNull();
  });

  it('suppresses projected input deltas marked as unsafe', () => {
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
            toolPayloadProjection: {
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

  it('uses projected tool errors', () => {
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
            toolPayloadProjection: {
              display: {
                'input-available': { projected: { customerId: 'cus_123' } },
                error: { projected: { message: 'Tool failed' } },
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
