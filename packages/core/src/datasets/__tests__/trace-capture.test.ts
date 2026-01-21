import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureSpanToDataset, captureTraceToDataset, captureTracesToDataset } from '../trace-capture';
import type { DatasetsStorage } from '../../storage/domains/datasets/base';
import type { ObservabilityStorage } from '../../storage/domains/observability/base';
import type { DatasetItem } from '../types';
import type { GetTraceResponse } from '../../storage/domains/observability/types';
import { SpanType } from '../../observability/types';

// ============================================================================
// Mocks
// ============================================================================

const mockStorage = {
  createDatasetItem: vi.fn(),
} as unknown as DatasetsStorage;

const mockObservability = {
  getTrace: vi.fn(),
} as unknown as ObservabilityStorage;

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockDatasetItem = (overrides: Partial<DatasetItem> = {}): DatasetItem => ({
  id: 'item-1',
  datasetId: 'dataset-1',
  input: { message: 'Hello' },
  expectedOutput: { response: 'World' },
  metadata: { key: 'value' },
  sourceTraceId: 'trace-1',
  sourceSpanId: 'span-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  archivedAt: null,
  ...overrides,
});

const createMockSpanRecord = (overrides: Partial<GetTraceResponse['spans'][0]> = {}) => ({
  traceId: 'trace-1',
  spanId: 'span-1',
  name: 'test-span',
  spanType: SpanType.TOOL_CALL,
  isEvent: false,
  startedAt: new Date('2024-01-01T10:00:00Z'),
  endedAt: new Date('2024-01-01T10:00:01Z'),
  input: { query: 'test input' },
  output: { result: 'test output' },
  metadata: { tool: 'test-tool' },
  parentSpanId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ============================================================================
// Tests: captureSpanToDataset
// ============================================================================

describe('captureSpanToDataset', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates item with span input/output', async () => {
    const expectedItem = createMockDatasetItem();
    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>).mockResolvedValue(expectedItem);

    const result = await captureSpanToDataset({
      storage: mockStorage,
      span: {
        spanId: 'span-1',
        traceId: 'trace-1',
        input: { message: 'Hello' },
        output: { response: 'World' },
        metadata: { key: 'value' },
      },
      datasetId: 'dataset-1',
    });

    expect(mockStorage.createDatasetItem).toHaveBeenCalledWith({
      datasetId: 'dataset-1',
      input: { message: 'Hello' },
      expectedOutput: { response: 'World' },
      metadata: { key: 'value' },
      sourceTraceId: 'trace-1',
      sourceSpanId: 'span-1',
    });
    expect(result).toEqual(expectedItem);
  });

  it('sets sourceTraceId and sourceSpanId', async () => {
    const expectedItem = createMockDatasetItem({
      sourceTraceId: 'custom-trace-id',
      sourceSpanId: 'custom-span-id',
    });
    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>).mockResolvedValue(expectedItem);

    await captureSpanToDataset({
      storage: mockStorage,
      span: {
        spanId: 'custom-span-id',
        traceId: 'custom-trace-id',
        input: 'test',
        output: 'result',
      },
      datasetId: 'dataset-1',
    });

    expect(mockStorage.createDatasetItem).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTraceId: 'custom-trace-id',
        sourceSpanId: 'custom-span-id',
      }),
    );
  });

  it('applies transform function if provided', async () => {
    const expectedItem = createMockDatasetItem({
      input: { transformed: 'input' },
      expectedOutput: { transformed: 'output' },
      metadata: { custom: 'metadata' },
    });
    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>).mockResolvedValue(expectedItem);

    const transform = vi.fn().mockReturnValue({
      input: { transformed: 'input' },
      expectedOutput: { transformed: 'output' },
      metadata: { custom: 'metadata' },
    });

    await captureSpanToDataset({
      storage: mockStorage,
      span: {
        spanId: 'span-1',
        traceId: 'trace-1',
        input: { original: 'input' },
        output: { original: 'output' },
        metadata: { original: 'metadata' },
      },
      datasetId: 'dataset-1',
      transform,
    });

    expect(transform).toHaveBeenCalledWith({
      input: { original: 'input' },
      output: { original: 'output' },
      metadata: { original: 'metadata' },
    });
    expect(mockStorage.createDatasetItem).toHaveBeenCalledWith({
      datasetId: 'dataset-1',
      input: { transformed: 'input' },
      expectedOutput: { transformed: 'output' },
      metadata: { custom: 'metadata' },
      sourceTraceId: 'trace-1',
      sourceSpanId: 'span-1',
    });
  });

  it('handles missing input/output gracefully', async () => {
    const expectedItem = createMockDatasetItem({
      input: undefined,
      expectedOutput: undefined,
      metadata: undefined,
    });
    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>).mockResolvedValue(expectedItem);

    await captureSpanToDataset({
      storage: mockStorage,
      span: {
        spanId: 'span-1',
        traceId: 'trace-1',
      },
      datasetId: 'dataset-1',
    });

    expect(mockStorage.createDatasetItem).toHaveBeenCalledWith({
      datasetId: 'dataset-1',
      input: undefined,
      expectedOutput: undefined,
      metadata: undefined,
      sourceTraceId: 'trace-1',
      sourceSpanId: 'span-1',
    });
  });
});

// ============================================================================
// Tests: captureTraceToDataset
// ============================================================================

describe('captureTraceToDataset', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches trace and creates items for all spans', async () => {
    const span1 = createMockSpanRecord({ spanId: 'span-1', input: 'input-1', output: 'output-1' });
    const span2 = createMockSpanRecord({ spanId: 'span-2', input: 'input-2', output: 'output-2' });
    const traceData: GetTraceResponse = {
      traceId: 'trace-1',
      spans: [span1, span2],
    };

    (mockObservability.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(traceData);
    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-1', sourceSpanId: 'span-1' }))
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-2', sourceSpanId: 'span-2' }));

    const result = await captureTraceToDataset({
      storage: mockStorage,
      observabilityStorage: mockObservability,
      traceId: 'trace-1',
      captureOptions: { datasetId: 'dataset-1' },
    });

    expect(mockObservability.getTrace).toHaveBeenCalledWith({ traceId: 'trace-1' });
    expect(mockStorage.createDatasetItem).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('item-1');
    expect(result[1].id).toBe('item-2');
  });

  it('applies spanFilter to exclude non-matching spans', async () => {
    const span1 = createMockSpanRecord({ spanId: 'span-1', spanType: SpanType.TOOL_CALL });
    const span2 = createMockSpanRecord({ spanId: 'span-2', spanType: SpanType.AGENT_RUN });
    const span3 = createMockSpanRecord({ spanId: 'span-3', spanType: SpanType.TOOL_CALL });
    const traceData: GetTraceResponse = {
      traceId: 'trace-1',
      spans: [span1, span2, span3],
    };

    (mockObservability.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(traceData);
    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-1', sourceSpanId: 'span-1' }))
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-3', sourceSpanId: 'span-3' }));

    const result = await captureTraceToDataset({
      storage: mockStorage,
      observabilityStorage: mockObservability,
      traceId: 'trace-1',
      captureOptions: {
        datasetId: 'dataset-1',
        spanFilter: span => span.spanType === SpanType.TOOL_CALL,
      },
    });

    // Should only create items for TOOL_CALL spans (span-1 and span-3)
    expect(mockStorage.createDatasetItem).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('returns empty array if no spans match filter', async () => {
    const span1 = createMockSpanRecord({ spanId: 'span-1', spanType: SpanType.WORKFLOW_RUN });
    const traceData: GetTraceResponse = {
      traceId: 'trace-1',
      spans: [span1],
    };

    (mockObservability.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(traceData);

    const result = await captureTraceToDataset({
      storage: mockStorage,
      observabilityStorage: mockObservability,
      traceId: 'trace-1',
      captureOptions: {
        datasetId: 'dataset-1',
        spanFilter: span => span.spanType === SpanType.TOOL_CALL,
      },
    });

    expect(mockStorage.createDatasetItem).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('throws error if trace not found', async () => {
    (mockObservability.getTrace as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      captureTraceToDataset({
        storage: mockStorage,
        observabilityStorage: mockObservability,
        traceId: 'nonexistent-trace',
        captureOptions: { datasetId: 'dataset-1' },
      }),
    ).rejects.toThrow('Trace not found: nonexistent-trace');
  });
});

// ============================================================================
// Tests: captureTracesToDataset
// ============================================================================

describe('captureTracesToDataset', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('processes multiple traces', async () => {
    const trace1: GetTraceResponse = {
      traceId: 'trace-1',
      spans: [createMockSpanRecord({ traceId: 'trace-1', spanId: 'span-1' })],
    };
    const trace2: GetTraceResponse = {
      traceId: 'trace-2',
      spans: [createMockSpanRecord({ traceId: 'trace-2', spanId: 'span-2' })],
    };

    (mockObservability.getTrace as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(trace1)
      .mockResolvedValueOnce(trace2);

    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-1', sourceTraceId: 'trace-1' }))
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-2', sourceTraceId: 'trace-2' }));

    const result = await captureTracesToDataset({
      storage: mockStorage,
      observabilityStorage: mockObservability,
      traceIds: ['trace-1', 'trace-2'],
      captureOptions: { datasetId: 'dataset-1' },
    });

    expect(mockObservability.getTrace).toHaveBeenCalledTimes(2);
    expect(mockObservability.getTrace).toHaveBeenCalledWith({ traceId: 'trace-1' });
    expect(mockObservability.getTrace).toHaveBeenCalledWith({ traceId: 'trace-2' });
    expect(result).toHaveLength(2);
  });

  it('returns flattened array of all items', async () => {
    const trace1: GetTraceResponse = {
      traceId: 'trace-1',
      spans: [
        createMockSpanRecord({ traceId: 'trace-1', spanId: 'span-1a' }),
        createMockSpanRecord({ traceId: 'trace-1', spanId: 'span-1b' }),
      ],
    };
    const trace2: GetTraceResponse = {
      traceId: 'trace-2',
      spans: [createMockSpanRecord({ traceId: 'trace-2', spanId: 'span-2a' })],
    };

    (mockObservability.getTrace as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(trace1)
      .mockResolvedValueOnce(trace2);

    (mockStorage.createDatasetItem as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-1a' }))
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-1b' }))
      .mockResolvedValueOnce(createMockDatasetItem({ id: 'item-2a' }));

    const result = await captureTracesToDataset({
      storage: mockStorage,
      observabilityStorage: mockObservability,
      traceIds: ['trace-1', 'trace-2'],
      captureOptions: { datasetId: 'dataset-1' },
    });

    // 2 spans from trace-1 + 1 span from trace-2 = 3 total items
    expect(mockStorage.createDatasetItem).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result.map(item => item.id)).toEqual(['item-1a', 'item-1b', 'item-2a']);
  });

  it('handles empty traceIds array', async () => {
    const result = await captureTracesToDataset({
      storage: mockStorage,
      observabilityStorage: mockObservability,
      traceIds: [],
      captureOptions: { datasetId: 'dataset-1' },
    });

    expect(mockObservability.getTrace).not.toHaveBeenCalled();
    expect(mockStorage.createDatasetItem).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
