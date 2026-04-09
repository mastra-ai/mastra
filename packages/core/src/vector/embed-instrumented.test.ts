import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ObservabilityContext } from '../observability';

vi.mock('./embed', () => ({
  embedV1: vi.fn(),
  embedV2: vi.fn(),
  embedV3: vi.fn(),
}));

import { embedV1, embedV2, embedV3 } from './embed';
import { embedForIngestion } from './embed-instrumented';

const mockEmbedV1 = vi.mocked(embedV1);
const mockEmbedV2 = vi.mocked(embedV2);
const mockEmbedV3 = vi.mocked(embedV3);

function createMockModel(specVersion: string) {
  return {
    specificationVersion: specVersion,
    modelId: 'text-embedding-3-small',
    provider: 'openai',
  } as any;
}

function createMockObservabilityContext() {
  const endFn = vi.fn();
  const errorFn = vi.fn();
  const createChildSpanFn = vi.fn().mockReturnValue({
    end: endFn,
    error: errorFn,
  });

  const ctx: ObservabilityContext = {
    tracingContext: {
      currentSpan: {
        createChildSpan: createChildSpanFn,
      },
    },
  } as any;

  return { ctx, createChildSpanFn, endFn, errorFn };
}

describe('embedForIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('works without observabilityContext (no-op tracing)', async () => {
    mockEmbedV3.mockResolvedValueOnce({ embedding: [0.1, 0.2, 0.3] } as any);

    const result = await embedForIngestion({
      model: createMockModel('v3'),
      values: ['hello world'],
    });

    expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]]);
    expect(mockEmbedV3).toHaveBeenCalledOnce();
  });

  it('creates a child span with correct attributes when observabilityContext is provided', async () => {
    mockEmbedV3.mockResolvedValueOnce({ embedding: [0.1, 0.2], usage: { tokens: 5 } } as any);
    mockEmbedV3.mockResolvedValueOnce({ embedding: [0.3, 0.4], usage: { tokens: 3 } } as any);

    const { ctx, createChildSpanFn, endFn } = createMockObservabilityContext();

    const result = await embedForIngestion({
      model: createMockModel('v3'),
      values: ['text one', 'text two'],
      observabilityContext: ctx,
    });

    expect(result.embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    // Verify child span was created with correct type and attributes
    expect(createChildSpanFn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'rag embed: ingest',
        input: { count: 2 },
        attributes: expect.objectContaining({
          mode: 'ingest',
          inputCount: 2,
        }),
      }),
    );

    // Verify span was ended with dimensions and usage
    expect(endFn).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({
          dimensions: 2,
          usage: { inputTokens: 8 },
        }),
        output: { vectorCount: 2, dimensions: 2 },
      }),
    );
  });

  it('calls embedV2 for v2 models', async () => {
    mockEmbedV2.mockResolvedValueOnce({ embedding: [1, 2, 3] } as any);

    await embedForIngestion({
      model: createMockModel('v2'),
      values: ['test'],
    });

    expect(mockEmbedV2).toHaveBeenCalledOnce();
    expect(mockEmbedV1).not.toHaveBeenCalled();
    expect(mockEmbedV3).not.toHaveBeenCalled();
  });

  it('calls embedV1 for v1/legacy models', async () => {
    mockEmbedV1.mockResolvedValueOnce({ embedding: [1, 2, 3] } as any);

    await embedForIngestion({
      model: createMockModel('v1'),
      values: ['test'],
    });

    expect(mockEmbedV1).toHaveBeenCalledOnce();
    expect(mockEmbedV2).not.toHaveBeenCalled();
    expect(mockEmbedV3).not.toHaveBeenCalled();
  });

  it('records error on span and re-throws when embedding fails', async () => {
    const error = new Error('embedding failed');
    mockEmbedV3.mockRejectedValueOnce(error);

    const { ctx, errorFn } = createMockObservabilityContext();

    await expect(
      embedForIngestion({
        model: createMockModel('v3'),
        values: ['test'],
        observabilityContext: ctx,
      }),
    ).rejects.toThrow('embedding failed');

    expect(errorFn).toHaveBeenCalledWith({ error, endSpan: true });
  });
});
