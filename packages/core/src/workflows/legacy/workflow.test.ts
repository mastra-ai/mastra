import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { LegacyStep } from './step';
import { LegacyWorkflow } from './workflow';

describe('LegacyWorkflow - until operator handling', () => {
  let workflow: LegacyWorkflow;
  let fallbackStep: LegacyStep;
  let sentinelStep: LegacyStep;
  let startStep: LegacyStep;

  // Extract type from workflow until method parameters
  type UntilCondition = Parameters<LegacyWorkflow['until']>[0];
  type StepContext = Parameters<LegacyStep['execute']>[0];

  // Helper functions for test setup and execution
  const makeEqCondition = (eq: string): UntilCondition => ({
    ref: { step: startStep, path: 'value' },
    query: { $eq: eq },
  });

  const makeNeCondition = (ne: string): UntilCondition => ({
    ref: { step: startStep, path: 'value' },
    query: { $ne: ne },
  });

  const makeGtCondition = (gt: number): UntilCondition => ({
    ref: { step: startStep, path: 'value' },
    query: { $gt: gt },
  });

  // Add helper for $lt condition
  const makeLtCondition = (lt: number): UntilCondition => ({
    ref: { step: startStep, path: 'value' },
    query: { $lt: lt },
  });

  const makeGteCondition = (gte: number): UntilCondition => ({
    ref: { step: startStep, path: 'value' },
    query: { $gte: gte },
  });

  const makeLteCondition = (lte: number): UntilCondition => ({
    ref: { step: startStep, path: 'value' },
    query: { $lte: lte },
  });

  const configureAndCommit = (condition: UntilCondition) => {
    workflow.step(startStep).until(condition, fallbackStep).then(sentinelStep).commit();
  };

  const runWorkflow = async () => {
    const run = workflow.createRun();
    const result = await run.start();
    return { run, result };
  };

  const hasSuspendedActivePaths = (result: { activePaths: any; results: any }) => {
    // Prefer checking results, as subscriber-machine suspensions are reflected here
    const resultsSuspended = Object.values(result.results || {}).some((v: any) => v?.status === 'suspended');
    if (resultsSuspended) return true;

    // Fallback to activePaths inspection
    try {
      const activePathsObj = Object.fromEntries(result.activePaths as any) as Record<string, { status: string }>;
      return Object.values(activePathsObj).some(v => v.status === 'suspended');
    } catch {
      return false;
    }
  };

  beforeEach(() => {
    // Reset mocks before each test to start from a clean slate
    vi.clearAllMocks();

    // Set up a basic workflow instance with a required name
    workflow = new LegacyWorkflow({ name: 'test-workflow' } as any);

    // Create an initial step so the loop has a preceding step and produces the referenced value
    startStep = new LegacyStep({
      id: 'start-step',
      execute: vi.fn().mockResolvedValue({ value: 'test' }),
    });

    // Fallback suspends to prevent infinite loop when condition keeps returning 'continue'
    fallbackStep = new LegacyStep({
      id: 'fallback-step',
      execute: vi.fn(async ({ suspend }: StepContext) => {
        await suspend();
        return { suspended: true } as any;
      }),
    });

    sentinelStep = new LegacyStep({
      id: 'sentinel-step',
      execute: vi.fn().mockResolvedValue({ status: 'complete', result: 'sentinel-executed' }),
    });
  });

  afterEach(() => {
    // Restore and clear mocks after each test to ensure proper teardown
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('should execute fallback and not proceed to sentinel when encountering unsupported operator (public API)', async () => {
    // Arrange: Configure workflow with unsupported operator via query-based condition
    const condition = {
      ref: { step: startStep, path: 'value' },
      query: { $unsupported: 'test' } as any,
    } as any;

    workflow.step(startStep).until(condition, fallbackStep).then(sentinelStep).commit();

    // Act: Execute the workflow through the public API
    const run = workflow.createRun();
    const result = await run.start();

    // Assert: Execution completed without throwing
    expect(result).toBeDefined();

    // Fallback should execute (since unsupported operator yields 'continue'), sentinel should not
    expect(fallbackStep.execute).toHaveBeenCalled();
    expect(sentinelStep.execute).not.toHaveBeenCalled();
  });

  it('should proceed to sentinel step when $eq condition is met (true case)', async () => {
    // Arrange: Configure workflow with matching condition
    const condition = makeEqCondition('test');
    configureAndCommit(condition);

    // Act: Execute the workflow
    const { result } = await runWorkflow();

    // Assert: Verify execution flow
    expect(result).toBeDefined();
    expect(fallbackStep.execute).not.toHaveBeenCalled();
    expect(sentinelStep.execute).toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(false);
  });

  it('should execute fallback and not proceed when $eq condition is not met (false case)', async () => {
    // Arrange: Configure workflow with non-matching condition
    const condition = makeEqCondition('not-matching');
    configureAndCommit(condition);

    // Act: Execute the workflow
    const { result } = await runWorkflow();

    // Assert: Verify execution flow and suspension state
    expect(result).toBeDefined();
    expect(fallbackStep.execute).toHaveBeenCalled();
    expect(sentinelStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(true);
  });

  it('should proceed to sentinel step when $ne condition is met', async () => {
    // Arrange
    startStep.execute.mockResolvedValue({ value: 'actual' });
    const condition = makeNeCondition('different');
    configureAndCommit(condition);

    // Act
    const { result } = await runWorkflow();

    // Assert
    expect(sentinelStep.execute).toHaveBeenCalled();
    expect(fallbackStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(false);
  });

  it('should execute fallback when $ne condition is not met (when values are equal)', async () => {
    // Arrange: Configure startStep to return 'test' and create $ne condition checking for 'test'
    startStep.execute.mockResolvedValue({ value: 'test' });
    const condition = makeNeCondition('test');
    configureAndCommit(condition);

    // Act: Run the workflow
    const { result } = await runWorkflow();

    // Assert: Verify fallback execution and workflow state
    expect(fallbackStep.execute).toHaveBeenCalled();
    expect(sentinelStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(true);
  });

  it('should proceed to sentinel step when $gt condition is met', async () => {
    // Arrange
    startStep.execute.mockResolvedValue({ value: 10 });
    const condition = makeGtCondition(5);
    configureAndCommit(condition);

    // Act
    const { result } = await runWorkflow();

    // Assert
    expect(sentinelStep.execute).toHaveBeenCalled();
    expect(fallbackStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(false);
  });

  it('should execute fallback when $gt condition is not met (when value <= target)', async () => {
    // Arrange: Configure startStep to return 5 and create $gt condition checking for > 5
    startStep.execute.mockResolvedValue({ value: 5 });
    const condition = makeGtCondition(5);
    configureAndCommit(condition);

    // Act: Run the workflow
    const { result } = await runWorkflow();

    // Assert: Verify fallback execution and workflow state
    expect(fallbackStep.execute).toHaveBeenCalled();
    expect(sentinelStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(true);
  });

  it('should proceed to sentinel step when $lt condition is met (value < target)', async () => {
    // Arrange: Configure startStep to return value 3 with target 5
    startStep.execute.mockResolvedValueOnce({ value: 3 });
    const condition = makeLtCondition(5);
    configureAndCommit(condition);

    // Act: Execute workflow
    const { result } = await runWorkflow();

    // Assert: Verify workflow proceeded past until block
    expect(fallbackStep.execute).not.toHaveBeenCalled();
    expect(sentinelStep.execute).toHaveBeenCalledTimes(1);
    expect(hasSuspendedActivePaths(result)).toBe(false);
  });

  it('should execute fallback when $lt condition is not met (value > target)', async () => {
    // Arrange: Configure startStep to return value 7 with target 5
    startStep.execute.mockResolvedValueOnce({ value: 7 });
    const condition = makeLtCondition(5);
    configureAndCommit(condition);

    // Act: Execute workflow
    const { result } = await runWorkflow();

    // Assert: Verify workflow executed fallback and suspended
    expect(fallbackStep.execute).toHaveBeenCalledTimes(1);
    expect(sentinelStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(true);
  });

  it('should proceed to sentinel step when $gte condition is met', async () => {
    // Arrange: Override startStep to return numeric value for $gte condition
    startStep.execute = vi.fn().mockResolvedValue({ value: 5 });
    configureAndCommit(makeGteCondition(5));

    // Act: Run the workflow
    const { result } = await runWorkflow();

    // Assert: Verify execution path
    expect(sentinelStep.execute).toHaveBeenCalled();
    expect(fallbackStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(false);
  });

  it('should execute fallback when $gte condition is not met', async () => {
    // Arrange: Override startStep to return numeric value for $gte condition
    startStep.execute = vi.fn().mockResolvedValue({ value: 5 });
    configureAndCommit(makeGteCondition(6));

    // Act: Run the workflow
    const { result } = await runWorkflow();

    // Assert: Verify execution path
    expect(sentinelStep.execute).not.toHaveBeenCalled();
    expect(fallbackStep.execute).toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(true);
  });

  it('should proceed to sentinel step when $lte condition is met', async () => {
    // Arrange: Override startStep to return numeric value for $lte condition
    startStep.execute = vi.fn().mockResolvedValue({ value: 5 });
    configureAndCommit(makeLteCondition(5));

    // Act: Run the workflow
    const { result } = await runWorkflow();

    // Assert: Verify execution path
    expect(sentinelStep.execute).toHaveBeenCalled();
    expect(fallbackStep.execute).not.toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(false);
  });

  it('should execute fallback when $lte condition is not met', async () => {
    // Arrange: Override startStep to return numeric value for $lte condition
    startStep.execute = vi.fn().mockResolvedValue({ value: 5 });
    configureAndCommit(makeLteCondition(4));

    // Act: Run the workflow
    const { result } = await runWorkflow();

    // Assert: Verify execution path
    expect(sentinelStep.execute).not.toHaveBeenCalled();
    expect(fallbackStep.execute).toHaveBeenCalled();
    expect(hasSuspendedActivePaths(result)).toBe(true);
  });
});
