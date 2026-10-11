import { describe, expect, it, vi } from 'vitest';

import {
  getTransformedToolPayload,
  normalizeToolPayloadTransformPolicy,
  transformToolPayloadForTargets,
  withToolPayloadTransformMetadata,
} from './payload-transform';
import type { ToolPayloadTransformPhase, ToolPayloadTransformTarget } from './types';

describe('tool payload transform', () => {
  it.each(['display', 'transcript'] as const)(
    'preserves completed input when only %s output has a transformer',
    async target => {
      const transform = await transformToolPayloadForTargets(
        {
          phase: 'input-available',
          toolName: 'lookup',
          toolCallId: 'call-1',
          input: { query: 'first' },
        },
        { toolTransform: { [target]: { output: () => ({ safe: true }) } } },
      );
      expect(transform).toBeUndefined();
    },
  );

  it.each(
    (['display', 'transcript'] as ToolPayloadTransformTarget[]).flatMap(target =>
      (['error', 'approval', 'suspend', 'resume'] as ToolPayloadTransformPhase[]).map(phase => ({ target, phase })),
    ),
  )('leaves an unconfigured $target $phase phase unchanged', async ({ target, phase }) => {
    const transform = await transformToolPayloadForTargets(
      { phase, toolName: 'lookup', toolCallId: 'call-1' },
      { toolTransform: { [target]: { output: () => ({ safe: true }) } } },
    );
    expect(transform).toBeUndefined();
  });

  it('still transforms outputs with an output-only transcript configuration', async () => {
    const transform = await transformToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName: 'lookup',
        toolCallId: 'call-1',
        output: { query: 'first', payload: 'large' },
      },
      { toolTransform: { transcript: { output: ({ output }) => ({ query: (output as { query: string }).query }) } } },
    );
    expect(transform?.transcript?.['output-available']).toEqual({ transformed: { query: 'first' } });
    expect(transform?.display).toBeUndefined();
  });

  it('keeps a configured transformer fail-closed when it returns undefined', async () => {
    const transform = await transformToolPayloadForTargets(
      { phase: 'output-available', toolName: 'lookup', toolCallId: 'call-1', output: { secret: 'raw' } },
      { toolTransform: { transcript: { output: () => undefined } } },
    );
    expect(transform?.transcript?.['output-available']).toEqual({
      transformed: { message: 'Tool output-available payload unavailable' },
    });
  });

  it('suppresses input deltas even when only output transformation is configured', async () => {
    const transform = await transformToolPayloadForTargets(
      { phase: 'input-delta', toolName: 'lookup', toolCallId: 'call-1', inputTextDelta: '{"query":' },
      { toolTransform: { transcript: { output: () => ({ safe: true }) } } },
    );
    expect(transform?.transcript?.['input-delta']).toEqual({ suppress: true });
  });

  it('keeps payloads untransformed when no policy is configured', async () => {
    const transform = await transformToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
        output: { displayName: 'Acme', apiKey: 'secret-output' },
      },
      undefined,
    );

    expect(transform).toBeUndefined();
  });

  it('stores target and phase specific transforms on chunk metadata', async () => {
    const transform = await transformToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
      },
      {
        policy: {
          targets: ['display'],
          transformToolPayload: ({ target, input }) =>
            target === 'display' ? { customerId: (input as { customerId: string }).customerId } : undefined,
        },
      },
    );

    const chunk = withToolPayloadTransformMetadata({ metadata: {} }, transform);

    expect(getTransformedToolPayload(chunk.metadata, 'display', 'input-available')).toEqual({
      transformed: { customerId: 'cus_123' },
    });
    expect(getTransformedToolPayload(chunk.metadata, 'transcript', 'input-available')).toBeUndefined();
  });

  it('reads legacy projected metadata as transformed metadata', () => {
    expect(
      getTransformedToolPayload(
        {
          mastra: {
            toolPayloadProjection: {
              display: {
                'input-available': { projected: { customerId: 'cus_123' } },
              },
            },
          },
        },
        'display',
        'input-available',
      ),
    ).toEqual({
      transformed: { customerId: 'cus_123' },
    });
  });

  it('normalizes legacy projection policies to transform policies', async () => {
    const policy = normalizeToolPayloadTransformPolicy({
      targets: ['display'],
      projectToolPayload: ({ input }) => ({ customerId: (input as { customerId: string }).customerId }),
    });

    const transform = await transformToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
      },
      { policy },
    );

    expect(transform?.display?.['input-available']).toEqual({
      transformed: { customerId: 'cus_123' },
    });
  });

  it('fails closed per target when a scoped central policy returns undefined', async () => {
    const transform = await transformToolPayloadForTargets(
      {
        phase: 'input-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        input: { customerId: 'cus_123', secret: 'raw-input' },
      },
      {
        policy: {
          targets: ['display'],
          transformToolPayload: () => undefined,
        },
      },
    );

    expect(transform?.display?.['input-available']).toEqual({
      transformed: { message: 'Tool input-available payload unavailable' },
    });
    expect(transform?.transcript).toBeUndefined();
  });

  it('suppresses input deltas when transform is configured without a delta projector', async () => {
    const transform = await transformToolPayloadForTargets(
      {
        phase: 'input-delta',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        inputTextDelta: '{"apiKey":"secret',
      },
      {
        toolTransform: {
          display: {
            input: ({ input }) => input,
          },
        },
      },
    );

    expect(transform?.display?.['input-delta']).toEqual({ suppress: true });
  });

  it('fails closed when a configured projector throws', async () => {
    const logger = { warn: vi.fn() };
    const transform = await transformToolPayloadForTargets(
      {
        phase: 'output-available',
        toolName: 'lookupCustomer',
        toolCallId: 'call-1',
        output: { apiKey: 'secret-output' },
      },
      {
        policy: {
          transformToolPayload: () => {
            throw new Error('transform failed');
          },
        },
      },
      logger as any,
    );

    expect(transform?.display?.['output-available']).toEqual({
      transformed: { message: 'Tool output-available payload unavailable' },
      failed: true,
    });
    expect(logger.warn).toHaveBeenCalled();
  });
});
