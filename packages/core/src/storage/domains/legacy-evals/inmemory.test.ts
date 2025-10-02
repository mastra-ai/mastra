import { describe, beforeEach, it, expect } from 'vitest';
import type { MetricResult, TestInfo } from '../../../eval';
import type { StorageEvalRow } from '../../types';
import { InMemoryLegacyEvals } from './inmemory';

describe('InMemoryLegacyEvals', () => {
  let storage: InMemoryLegacyEvals;
  let collection: Map<string, StorageEvalRow>;

  beforeEach(() => {
    collection = new Map();
    storage = new InMemoryLegacyEvals({ collection });
  });

  const createEvalRow = (overrides: Partial<StorageEvalRow> = {}): StorageEvalRow => {
    const defaults: StorageEvalRow = {
      id: '1',
      agent_name: 'agent1',
      input: 'test input',
      output: 'test output',
      instructions: 'test instructions',
      result: { score: 1 },
      created_at: new Date('2023-01-01'),
      metric_name: 'metric1',
      run_id: 'run1',
      global_run_id: 'global1',
    };

    return { ...defaults, ...overrides };
  };

  it('should correctly transform StorageEvalRow fields to EvalRow format', async () => {
    // Arrange: Create a test record with all possible fields
    const testDate = new Date('2023-01-01T00:00:00Z');
    const testMetricResult: MetricResult = { score: 0.95 };
    const testInfo: TestInfo = { testPath: '/path/to/test' };

    collection.set('eval1', {
      agent_name: 'test-agent',
      input: 'test input',
      output: 'test output',
      instructions: 'test instructions',
      result: testMetricResult,
      created_at: testDate,
      test_info: testInfo,
      metric_name: 'accuracy',
      run_id: 'run-1',
      global_run_id: 'global-1',
    });

    // Act: Retrieve evals with default pagination
    const result = await storage.getEvals({});

    // Assert: Verify field transformations
    expect(result.evals).toHaveLength(1);
    const transformedEval = result.evals[0];

    expect(transformedEval).toEqual({
      agentName: 'test-agent',
      input: 'test input',
      output: 'test output',
      instructions: 'test instructions',
      result: testMetricResult,
      createdAt: testDate.toISOString(),
      testInfo: testInfo,
      metricName: 'accuracy',
      runId: 'run-1',
      globalRunId: 'global-1',
    });
  });

  it('should calculate hasMore flag correctly based on pagination', async () => {
    // Arrange: Add multiple records to collection
    const baseDate = new Date('2023-01-01T00:00:00Z');
    for (let i = 0; i < 15; i++) {
      collection.set(`eval${i}`, {
        agent_name: `agent-${i}`,
        input: `input ${i}`,
        output: `output ${i}`,
        instructions: `instructions ${i}`,
        result: { score: 0.9 },
        created_at: new Date(baseDate.getTime() + i * 1000),
        metric_name: 'accuracy',
        run_id: `run-${i}`,
        global_run_id: `global-${i}`,
        test_info: null,
      });
    }

    // Act: Get first page
    const firstPage = await storage.getEvals({ perPage: 10, page: 0 });
    // Act: Get last page
    const lastPage = await storage.getEvals({ perPage: 10, page: 1 });

    // Assert: Verify pagination behavior
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.evals).toHaveLength(10);
    expect(firstPage.total).toBe(15);
    expect(firstPage.page).toBe(0);
    expect(firstPage.perPage).toBe(10);

    expect(lastPage.hasMore).toBe(false);
    expect(lastPage.evals).toHaveLength(5);
    expect(lastPage.total).toBe(15);
    expect(lastPage.page).toBe(1);
    expect(lastPage.perPage).toBe(10);
  });

  it('should return correct pagination structure when collection is empty', async () => {
    // Arrange: Set up pagination parameters
    const page = 0;
    const perPage = 10;

    // Act: Call getEvals with pagination parameters
    const result = await storage.getEvals({
      page,
      perPage,
    });

    // Assert: Verify pagination structure and empty results
    expect(result.evals).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(result.page).toBe(page);
    expect(result.perPage).toBe(perPage);
  });

  it('should filter evals by agentName when provided in options', async () => {
    // Arrange: Create eval records with different agent names
    const eval1 = createEvalRow({ id: '1', agent_name: 'agent1', created_at: new Date('2023-01-01') });
    const eval2 = createEvalRow({ id: '2', agent_name: 'agent1', created_at: new Date('2023-01-02') });
    const eval3 = createEvalRow({ id: '3', agent_name: 'agent2', created_at: new Date('2023-01-03') });

    collection.set('1', eval1);
    collection.set('2', eval2);
    collection.set('3', eval3);

    // Act & Assert: Test successful filtering
    const successResult = await storage.getEvals({ agentName: 'agent1' });

    expect(successResult.evals).toHaveLength(2);
    expect(successResult.total).toBe(2);
    expect(successResult.evals.every(e => e.agentName === 'agent1')).toBe(true);
    expect(successResult.page).toBe(0);
    expect(successResult.perPage).toBe(100);
    expect(successResult.hasMore).toBe(false);

    // Verify complete transformation
    const transformedEval = successResult.evals[0];
    expect(transformedEval).toEqual({
      agentName: eval2.agent_name,
      input: eval2.input,
      output: eval2.output,
      instructions: eval2.instructions,
      result: eval2.result,
      createdAt: eval2.created_at.toISOString(),
      metricName: eval2.metric_name,
      runId: eval2.run_id,
      globalRunId: eval2.global_run_id,
      testInfo: undefined,
    });

    // Act & Assert: Test empty result case
    const emptyResult = await storage.getEvals({ agentName: 'nonexistent' });
    expect(emptyResult.evals).toHaveLength(0);
    expect(emptyResult.total).toBe(0);
    expect(emptyResult.page).toBe(0);
    expect(emptyResult.perPage).toBe(100);
    expect(emptyResult.hasMore).toBe(false);
  });

  it('should filter evals by type=test correctly', async () => {
    // Arrange: Create eval records with different test_info configurations
    const evalWithTestPath1 = createEvalRow({
      id: '1',
      created_at: new Date('2023-01-01'),
      test_info: { testPath: 'test/path1' },
    });

    const evalWithTestPath2 = createEvalRow({
      id: '2',
      created_at: new Date('2023-01-02'),
      test_info: { testPath: 'test/path2' },
    });

    const evalWithTestInfoNoPath = createEvalRow({
      id: '3',
      created_at: new Date('2023-01-03'),
      test_info: { someOtherField: 'value' },
    });

    const evalWithoutTestInfo = createEvalRow({
      id: '4',
      created_at: new Date('2023-01-04'),
    });

    collection.set('1', evalWithTestPath1);
    collection.set('2', evalWithTestPath2);
    collection.set('3', evalWithTestInfoNoPath);
    collection.set('4', evalWithoutTestInfo);

    // Act: Get evals filtered by type=test
    const result = await storage.getEvals({ type: 'test' });

    // Assert: Verify filtering and pagination
    expect(result.evals).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(0);
    expect(result.perPage).toBe(100);
    expect(result.hasMore).toBe(false);
    expect(result.evals.every(e => e.testInfo && 'testPath' in e.testInfo)).toBe(true);

    // Verify complete transformation
    expect(result.evals[0]).toEqual({
      agentName: evalWithTestPath2.agent_name,
      input: evalWithTestPath2.input,
      output: evalWithTestPath2.output,
      instructions: evalWithTestPath2.instructions,
      result: evalWithTestPath2.result as MetricResult,
      createdAt: evalWithTestPath2.created_at.toISOString(),
      testInfo: evalWithTestPath2.test_info as TestInfo,
      metricName: evalWithTestPath2.metric_name,
      runId: evalWithTestPath2.run_id,
      globalRunId: evalWithTestPath2.global_run_id,
    });
  });

  it('should filter evals by type=live correctly', async () => {
    // Arrange: Create eval records with different test_info configurations
    const evalWithoutTestInfo1 = createEvalRow({
      id: '1',
      created_at: new Date('2023-01-01'),
    });

    const evalWithoutTestInfo2 = createEvalRow({
      id: '2',
      created_at: new Date('2023-01-02'),
    });

    const evalWithTestInfoNoPath = createEvalRow({
      id: '3',
      created_at: new Date('2023-01-03'),
      test_info: { someOtherField: 'value' },
    });

    const evalWithTestPath = createEvalRow({
      id: '4',
      created_at: new Date('2023-01-04'),
      test_info: { testPath: 'test/path' },
    });

    collection.set('1', evalWithoutTestInfo1);
    collection.set('2', evalWithoutTestInfo2);
    collection.set('3', evalWithTestInfoNoPath);
    collection.set('4', evalWithTestPath);

    // Act: Get evals filtered by type=live
    const result = await storage.getEvals({ type: 'live' });

    // Assert: Verify filtering and pagination
    expect(result.evals).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.page).toBe(0);
    expect(result.perPage).toBe(100);
    expect(result.hasMore).toBe(false);
    expect(result.evals.every(e => !e.testInfo || !('testPath' in e.testInfo))).toBe(true);

    // Verify complete transformation - should be evalWithTestInfoNoPath (newest first)
    expect(result.evals[0]).toEqual({
      agentName: evalWithTestInfoNoPath.agent_name,
      input: evalWithTestInfoNoPath.input,
      output: evalWithTestInfoNoPath.output,
      instructions: evalWithTestInfoNoPath.instructions,
      result: evalWithTestInfoNoPath.result as MetricResult,
      createdAt: evalWithTestInfoNoPath.created_at.toISOString(),
      testInfo: evalWithTestInfoNoPath.test_info as TestInfo,
      metricName: evalWithTestInfoNoPath.metric_name,
      runId: evalWithTestInfoNoPath.run_id,
      globalRunId: evalWithTestInfoNoPath.global_run_id,
    });
  });
});
