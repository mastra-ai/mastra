import { describe, expect, it, vi } from 'vitest';

import {
  getProjectedToolPayload,
  projectToolPayloadForTargets,
  withToolPayloadProjectionMetadata,
} from './payload-projection';

describe('tool payload projection', () => {
  it('keeps payloads unprojected when no policy is configured', async () => {
    const projection = await projectToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
        output: { displayName: 'Acme', apiKey: 'secret-output' },
      },
      undefined,
    );

    expect(projection).toBeUndefined();
  });

  it('stores target and phase specific projections on chunk metadata', async () => {
    const projection = await projectToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
      },
      {
        policy: {
          targets: ['display'],
          projectToolPayload: ({ target, input }) =>
            target === 'display' ? { customerId: (input as { customerId: string }).customerId } : undefined,
        },
      },
    );

    const chunk = withToolPayloadProjectionMetadata({ metadata: {} }, projection);

    expect(getProjectedToolPayload(chunk.metadata, 'display', 'input-available')).toEqual({
      projected: { customerId: 'cus_123' },
    });
    expect(getProjectedToolPayload(chunk.metadata, 'transcript', 'input-available')).toBeUndefined();
  });

  it('fails closed per target when a scoped central policy returns undefined', async () => {
    const projection = await projectToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
      },
      {
        policy: {
          targets: ['display'],
          projectToolPayload: () => undefined,
        },
      },
    );

    expect(projection?.display?.['input-available']).toEqual({
      projected: { message: 'Tool input-available payload unavailable' },
    });
    expect(projection?.transcript).toBeUndefined();
  });

  it('suppresses input deltas when projection is configured without a delta projector', async () => {
    const projection = await projectToolPayloadForTargets(
      {
        phase: 'input-delta',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        inputTextDelta: '{"apiKey":"secret',
      },
      {
        toolProjection: {
          display: {
            input: ({ input }) => input,
          },
        },
      },
    );

    expect(projection?.display?.['input-delta']).toEqual({ suppress: true });
  });

  it('fails closed when a configured projector throws', async () => {
    const logger = { warn: vi.fn() };
    const projection = await projectToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        output: { apiKey: 'secret-output' },
      },
      {
        policy: {
          projectToolPayload: () => {
            throw new Error('projection failed');
          },
        },
      },
      logger as any,
    );

    expect(projection?.display?.['output-available']).toEqual({
      projected: { message: 'Tool output-available payload unavailable' },
      failed: true,
    });
    expect(logger.warn).toHaveBeenCalled();
  });
});
