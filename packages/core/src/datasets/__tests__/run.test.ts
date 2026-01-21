import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDataset } from '../run';
import type { DatasetsStorage } from '../../storage/domains/datasets/base';
import type { Agent } from '../../agent';
import type { Workflow } from '../../workflows';
import type { DatasetItem, DatasetRun, DatasetRunResult, ListDatasetItemsResponse } from '../types';

// ============================================================================
// Mocks
// ============================================================================

const mockStorage = {
  listDatasetItems: vi.fn(),
  createDatasetRun: vi.fn(),
  updateDatasetRun: vi.fn(),
  createDatasetRunResult: vi.fn(),
} as unknown as DatasetsStorage;

const mockAgent = {
  generate: vi.fn(),
} as unknown as Agent;

const mockWorkflow = {
  createRun: vi.fn(),
  execute: vi.fn(),
} as unknown as Workflow;

// ============================================================================
// Test Data Factories
// ============================================================================

const createMockDatasetItem = (overrides: Partial<DatasetItem> = {}): DatasetItem => ({
  id: `item-${Math.random().toString(36).slice(2, 8)}`,
  datasetId: 'dataset-1',
  input: { prompt: 'Test input' },
  expectedOutput: { response: 'Expected output' },
  metadata: { source: 'test' },
  sourceTraceId: undefined,
  sourceSpanId: undefined,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  archivedAt: null,
  ...overrides,
});

const createMockDatasetRun = (overrides: Partial<DatasetRun> = {}): DatasetRun => ({
  id: 'run-1',
  datasetId: 'dataset-1',
  name: 'Test Run',
  targetType: 'AGENT',
  targetId: 'test-agent',
  scorerIds: [],
  status: 'running',
  itemCount: 2,
  completedCount: 0,
  metadata: {},
  createdAt: new Date('2024-01-01'),
  completedAt: null,
  ...overrides,
});

const createMockListItemsResponse = (items: DatasetItem[]): ListDatasetItemsResponse => ({
  pagination: {
    page: 1,
    perPage: items.length || 10,
    totalPages: 1,
    totalRecords: items.length,
  },
  items,
});

// ============================================================================
// Tests
// ============================================================================

describe('runDataset', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Test 1: Creates run record with correct itemCount
  // --------------------------------------------------------------------------
  it('creates run record with correct itemCount', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' }), createMockDatasetItem({ id: 'item-2' })];
    const mockRun = createMockDatasetRun({ itemCount: 2 });

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockResolvedValue({ result: 'ok' });

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    expect(mockStorage.createDatasetRun).toHaveBeenCalledWith(
      expect.objectContaining({
        datasetId: 'dataset-1',
        itemCount: 2,
      }),
    );
  });

  // --------------------------------------------------------------------------
  // Test 2: Processes items and creates results
  // --------------------------------------------------------------------------
  it('processes items and creates results', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' }), createMockDatasetItem({ id: 'item-2' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockResolvedValue({ output: 'success' });

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    expect(customFn).toHaveBeenCalledTimes(2);
    expect(mockStorage.createDatasetRunResult).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('success');
    expect(result.results[1].status).toBe('success');
  });

  // --------------------------------------------------------------------------
  // Test 3: Calls onProgress callback
  // --------------------------------------------------------------------------
  it('calls onProgress callback', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' }), createMockDatasetItem({ id: 'item-2' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const onProgress = vi.fn();
    const customFn = vi.fn().mockResolvedValue({ output: 'ok' });

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      onProgress,
      storage: mockStorage,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  // --------------------------------------------------------------------------
  // Test 4: Updates run status to 'completed' on success
  // --------------------------------------------------------------------------
  it('updates run status to completed on success', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockResolvedValue({ output: 'ok' });

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    // Last updateDatasetRun call should set status to 'completed'
    const updateCalls = (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1];
    expect(lastCall[1]).toMatchObject({
      status: 'completed',
      completedAt: expect.any(Date),
    });
  });

  // --------------------------------------------------------------------------
  // Test 5: Handles agent target type
  // --------------------------------------------------------------------------
  it('handles agent target type', async () => {
    const items = [createMockDatasetItem({ id: 'item-1', input: { message: 'Hello agent' } })];
    const mockRun = createMockDatasetRun({ targetType: 'AGENT', targetId: 'my-agent' });

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    (mockAgent.generate as ReturnType<typeof vi.fn>).mockResolvedValue({ text: 'Agent response' });

    const getAgent = vi.fn().mockReturnValue(mockAgent);

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'agent', agentId: 'my-agent' },
      storage: mockStorage,
      getAgent,
    });

    expect(getAgent).toHaveBeenCalledWith('my-agent');
    expect(mockAgent.generate).toHaveBeenCalledWith(JSON.stringify(items[0].input));
    expect(mockStorage.createDatasetRun).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'AGENT',
        targetId: 'my-agent',
      }),
    );
  });

  // --------------------------------------------------------------------------
  // Test 6: Handles workflow target type
  // --------------------------------------------------------------------------
  it('handles workflow target type', async () => {
    const items = [createMockDatasetItem({ id: 'item-1', input: { task: 'Process data' } })];
    const mockRun = createMockDatasetRun({ targetType: 'WORKFLOW', targetId: 'my-workflow' });

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const mockWorkflowRun = {
      start: vi.fn().mockResolvedValue({ result: 'Workflow result' }),
    };
    (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkflowRun);

    const getWorkflow = vi.fn().mockReturnValue(mockWorkflow);

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'workflow', workflowId: 'my-workflow' },
      storage: mockStorage,
      getWorkflow,
    });

    expect(getWorkflow).toHaveBeenCalledWith('my-workflow');
    expect(mockWorkflow.createRun).toHaveBeenCalled();
    expect(mockWorkflowRun.start).toHaveBeenCalledWith({ inputData: items[0].input });
    expect(mockStorage.createDatasetRun).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'WORKFLOW',
        targetId: 'my-workflow',
      }),
    );
  });

  // --------------------------------------------------------------------------
  // Test 7: Handles custom function target type
  // --------------------------------------------------------------------------
  it('handles custom function target type', async () => {
    const items = [createMockDatasetItem({ id: 'item-1', input: { data: 'custom input' } })];
    const mockRun = createMockDatasetRun({ targetType: 'CUSTOM', targetId: undefined });

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockResolvedValue({ processed: true });

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    expect(customFn).toHaveBeenCalledWith(items[0].input);
    expect(mockStorage.createDatasetRun).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'CUSTOM',
        targetId: undefined,
      }),
    );
  });

  // --------------------------------------------------------------------------
  // Test 8: Captures errors in results without stopping run
  // --------------------------------------------------------------------------
  it('captures errors in results without stopping run', async () => {
    const items = [
      createMockDatasetItem({ id: 'item-1' }),
      createMockDatasetItem({ id: 'item-2' }),
      createMockDatasetItem({ id: 'item-3' }),
    ];
    const mockRun = createMockDatasetRun({ itemCount: 3 });

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi
      .fn()
      .mockResolvedValueOnce({ output: 'ok' })
      .mockRejectedValueOnce(new Error('Processing failed'))
      .mockResolvedValueOnce({ output: 'ok' });

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    // All items processed despite error
    expect(customFn).toHaveBeenCalledTimes(3);
    expect(mockStorage.createDatasetRunResult).toHaveBeenCalledTimes(3);
    expect(result.results).toHaveLength(3);

    // Verify error captured
    expect(result.results[0].status).toBe('success');
    expect(result.results[1].status).toBe('error');
    expect(result.results[1].error).toBe('Processing failed');
    expect(result.results[2].status).toBe('success');

    // Run should complete, not fail
    const updateCalls = (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1];
    expect(lastCall[1]).toMatchObject({ status: 'completed' });
  });

  // --------------------------------------------------------------------------
  // Test 9: Sets status to 'failed' if all items fail
  // --------------------------------------------------------------------------
  it('sets status to failed if all items fail', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' }), createMockDatasetItem({ id: 'item-2' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockRejectedValue(new Error('All failed'));

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    expect(result.results.every(r => r.status === 'error')).toBe(true);

    const updateCalls = (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1];
    expect(lastCall[1]).toMatchObject({ status: 'failed' });
  });

  // --------------------------------------------------------------------------
  // Test 10: Respects concurrency option
  // --------------------------------------------------------------------------
  it('respects concurrency option', async () => {
    const items = [
      createMockDatasetItem({ id: 'item-1' }),
      createMockDatasetItem({ id: 'item-2' }),
      createMockDatasetItem({ id: 'item-3' }),
      createMockDatasetItem({ id: 'item-4' }),
    ];
    const mockRun = createMockDatasetRun({ itemCount: 4 });

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    // Track concurrent executions
    let currentConcurrency = 0;
    let maxConcurrency = 0;

    const customFn = vi.fn().mockImplementation(async () => {
      currentConcurrency++;
      maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
      // Small delay to allow concurrent execution detection
      await new Promise(resolve => setTimeout(resolve, 10));
      currentConcurrency--;
      return { output: 'ok' };
    });

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      concurrency: 2,
      storage: mockStorage,
    });

    expect(customFn).toHaveBeenCalledTimes(4);
    // With concurrency=2, max concurrent should be at most 2
    expect(maxConcurrency).toBeLessThanOrEqual(2);
    expect(maxConcurrency).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // Test 11: Uses asOf for point-in-time queries
  // --------------------------------------------------------------------------
  it('uses asOf for point-in-time queries', async () => {
    const asOfDate = new Date('2024-06-15T12:00:00Z');
    const items = [createMockDatasetItem({ id: 'item-1' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockResolvedValue({ output: 'ok' });

    await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      asOf: asOfDate,
      storage: mockStorage,
    });

    expect(mockStorage.listDatasetItems).toHaveBeenCalledWith(
      { datasetId: 'dataset-1', asOf: asOfDate },
      { page: 1, perPage: false },
    );
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  it('handles empty dataset gracefully', async () => {
    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse([]));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockDatasetRun({ itemCount: 0 }),
    );
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockDatasetRun({ itemCount: 0 }),
    );

    const customFn = vi.fn();

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    expect(customFn).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(0);
    // Empty dataset should complete (not fail)
    const updateCalls = (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1];
    expect(lastCall[1]).toMatchObject({ status: 'completed' });
  });

  it('throws error when agent not found', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const getAgent = vi.fn().mockReturnValue(undefined);

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'agent', agentId: 'missing-agent' },
      storage: mockStorage,
      getAgent,
    });

    // Error captured in result, not thrown
    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toBe('Agent "missing-agent" not found');
  });

  it('throws error when workflow not found', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const getWorkflow = vi.fn().mockReturnValue(undefined);

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'workflow', workflowId: 'missing-workflow' },
      storage: mockStorage,
      getWorkflow,
    });

    // Error captured in result, not thrown
    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toBe('Workflow "missing-workflow" not found');
  });

  it('includes duration in results', async () => {
    const items = [createMockDatasetItem({ id: 'item-1' })];
    const mockRun = createMockDatasetRun();

    (mockStorage.listDatasetItems as ReturnType<typeof vi.fn>).mockResolvedValue(createMockListItemsResponse(items));
    (mockStorage.createDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.updateDatasetRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    (mockStorage.createDatasetRunResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const customFn = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { output: 'ok' };
    });

    const result = await runDataset({
      datasetId: 'dataset-1',
      target: { type: 'custom', fn: customFn },
      storage: mockStorage,
    });

    expect(result.results[0].durationMs).toBeGreaterThanOrEqual(50);
  });
});
