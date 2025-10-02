import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

// Mock the hooks module, preserving other exports and mocking only executeHook
vi.mock('../hooks', async () => {
  const actual = await vi.importActual<any>('../hooks');
  return {
    ...actual,
    executeHook: vi.fn(),
  };
});

import { executeHook, AvailableHooks } from '../hooks';
import { runScorer } from './hooks';
import type { ScoringEntityType, ScoringSource } from './types';

// Helper function for creating scorer objects
const makeScorerObject = (name = 'Test Scorer', description = 'Test Description', sampling = { type: 'none' }) => ({
  sampling,
  scorer: { name, description },
});

// Helper function for creating runScorer parameters
const makeRunScorerParams = scorerObject => ({
  scorerId: 'test-scorer-id',
  scorerObject,
  runId: 'test-run-id',
  input: { testInput: 'value' },
  output: { testOutput: 'result' },
  runtimeContext: new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ]),
  entity: { entityField: 'entityValue' },
  structuredOutput: true,
  source: 'TEST' as ScoringSource,
  entityType: 'AGENT' as ScoringEntityType,
  threadId: 'test-thread-id',
  resourceId: 'test-resource-id',
  tracingContext: { traceId: 'test-trace-id' },
});

describe('runScorer', () => {
  const originalMathRandom = Math.random;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    Math.random = originalMathRandom;
  });

  it('should construct payload with all expected fields mapped correctly', () => {
    // Arrange: Create test fixtures with all required fields
    const scorerId = 'test-scorer-id';
    const scorerObject = makeScorerObject('Test Scorer', 'A test scorer description');
    const runId = 'test-run-id';
    const input = { testInput: 'value' };
    const output = { testOutput: 'result' };
    const runtimeContext = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    const entity = { entityField: 'entityValue' };
    const structuredOutput = true;
    const source: ScoringSource = 'TEST';
    const entityType: ScoringEntityType = 'AGENT';
    const threadId = 'test-thread-id';
    const resourceId = 'test-resource-id';
    const tracingContext = { traceId: 'test-trace-id' };

    // Act: Call runScorer and capture the payload from executeHook
    runScorer({
      scorerId,
      scorerObject,
      runId,
      input,
      output,
      runtimeContext,
      entity,
      structuredOutput,
      source,
      entityType,
      threadId,
      resourceId,
      tracingContext,
    });

    // Assert: Verify payload field mappings
    const capturedPayload = (executeHook as any).mock.calls[0][1];
    expect(capturedPayload).toEqual({
      scorer: {
        id: scorerId,
        name: scorerObject.scorer.name,
        description: scorerObject.scorer.description,
      },
      input,
      output,
      runtimeContext: Object.fromEntries(runtimeContext),
      runId,
      source,
      entity,
      structuredOutput,
      entityType,
      threadId,
      resourceId,
      tracingContext,
    });
  });

  it('should call executeHook with ON_SCORER_RUN hook type', () => {
    // Arrange: Create minimal valid input
    const scorerObject = makeScorerObject();

    // Act: Call runScorer with minimal parameters
    runScorer({
      scorerId: 'test-id',
      scorerObject,
      runId: 'run-id',
      input: {},
      output: {},
      runtimeContext: new Map(),
      entity: {},
      structuredOutput: false,
      source: 'TEST',
      entityType: 'AGENT',
    });

    // Assert: Verify hook execution
    expect(executeHook).toHaveBeenCalledTimes(1);
    expect((executeHook as any).mock.calls[0][0]).toBe(AvailableHooks.ON_SCORER_RUN);
  });

  it('should construct payload with undefined values for optional parameters when threadId, resourceId, and tracingContext are not provided', () => {
    // Arrange: Create test fixtures without optional parameters
    const scorerObject = makeScorerObject('Test Scorer', 'Test Description');
    const params = makeRunScorerParams(scorerObject);
    // Remove optional parameters to test undefined behavior
    delete params.threadId;
    delete params.resourceId;
    delete params.tracingContext;

    // Act: Call runScorer without optional parameters
    runScorer(params);

    // Assert: Verify payload structure and undefined optional fields
    expect(executeHook).toHaveBeenCalledTimes(1);
    expect(executeHook).toHaveBeenCalledWith(AvailableHooks.ON_SCORER_RUN, {
      scorer: {
        id: params.scorerId,
        name: scorerObject.scorer.name,
        description: scorerObject.scorer.description,
      },
      input: params.input,
      output: params.output,
      runtimeContext: Object.fromEntries(params.runtimeContext),
      runId: params.runId,
      source: params.source,
      entity: params.entity,
      structuredOutput: params.structuredOutput,
      entityType: params.entityType,
      threadId: undefined,
      resourceId: undefined,
      tracingContext: undefined,
    });
  });

  it('ratio sampling: should return early when sampling check fails', () => {
    // Arrange: Set up test data with ratio sampling that will fail
    Math.random = () => 0.8; // Will be higher than sampling rate
    const scorerObject = makeScorerObject('Test Scorer', 'Test Description', {
      type: 'ratio',
      rate: 0.5,
    });

    // Act: Call runScorer with ratio sampling configuration
    runScorer({
      scorerId: 'test-id',
      scorerObject,
      runId: 'test-run',
      input: {},
      output: {},
      runtimeContext: new Map(),
      entity: {},
      structuredOutput: false,
      source: 'TEST',
      entityType: 'AGENT',
    });

    // Assert: Verify executeHook was not called
    expect(executeHook).not.toHaveBeenCalled();
  });

  it('ratio sampling: should execute hook with full payload when sampling check passes', () => {
    // Arrange: Set up test data with ratio sampling that will pass
    Math.random = () => 0.2; // Will be lower than sampling rate
    const scorerId = 'test-scorer-id';
    const scorerObject = makeScorerObject('Test Scorer', 'Test Description', {
      type: 'ratio',
      rate: 0.5,
    });
    const runId = 'test-run-id';
    const input = { testInput: 'value' };
    const output = { testOutput: 'result' };
    const runtimeContext = new Map([['key1', 'value1']]);
    const entity = { entityField: 'value' };
    const source: ScoringSource = 'TEST';
    const entityType: ScoringEntityType = 'AGENT';
    const threadId = 'test-thread';
    const resourceId = 'test-resource';
    const tracingContext = { traceId: 'test-trace' };

    // Act: Call runScorer with ratio sampling configuration
    runScorer({
      scorerId,
      scorerObject,
      runId,
      input,
      output,
      runtimeContext,
      entity,
      structuredOutput: true,
      source,
      entityType,
      threadId,
      resourceId,
      tracingContext,
    });

    // Assert: Verify hook execution and payload structure
    expect(executeHook).toHaveBeenCalledTimes(1);
    expect(executeHook).toHaveBeenCalledWith(AvailableHooks.ON_SCORER_RUN, {
      scorer: {
        id: scorerId,
        name: scorerObject.scorer.name,
        description: scorerObject.scorer.description,
      },
      input,
      output,
      runtimeContext: Object.fromEntries(runtimeContext),
      runId,
      source,
      entity,
      structuredOutput: true,
      entityType,
      threadId,
      resourceId,
      tracingContext,
    });
  });

  it('should call executeHook when an unknown sampling type is provided', () => {
    // Arrange: Create scorer object with an unknown sampling type
    const scorerObject = makeScorerObject('Test Scorer', 'Test Description', {
      type: 'invalid-sampling-type',
    });

    // Act: Call runScorer with the unknown sampling type scorer
    runScorer({
      scorerId: 'test-id',
      scorerObject,
      runId: 'run-id',
      input: {},
      output: {},
      runtimeContext: new Map(),
      entity: {},
      structuredOutput: false,
      source: 'TEST',
      entityType: 'AGENT',
    });

    // Assert: Verify hook execution
    expect(executeHook).toHaveBeenCalledTimes(1);
    expect(executeHook).toHaveBeenCalledWith(AvailableHooks.ON_SCORER_RUN, expect.any(Object));
  });

  it('should return early when sampling exists but has no type property', () => {
    // Arrange: Create scorer object with sampling that lacks type property using makeScorerObject
    const scorerObject = makeScorerObject('Test Scorer', 'Test Description', {});

    // Act: Call runScorer with minimum required parameters
    runScorer({
      scorerId: 'test-id',
      scorerObject,
      runId: 'run-id',
      input: {},
      output: {},
      runtimeContext: new Map(),
      entity: {},
      structuredOutput: false,
      source: 'TEST' as ScoringSource,
      entityType: 'AGENT' as ScoringEntityType,
    });

    // Assert: Verify executeHook was not called
    expect(executeHook).not.toHaveBeenCalled();
  });

  it('sampling undefined: should execute hook with complete payload', () => {
    // Arrange: Create scorer object without sampling property
    const scorerObject = makeScorerObject();
    delete scorerObject.sampling;
    const params = makeRunScorerParams(scorerObject);

    // Act: Call runScorer with undefined sampling
    runScorer(params);

    // Assert: Verify hook execution and payload structure
    expect(executeHook).toHaveBeenCalledTimes(1);
    expect(executeHook).toHaveBeenCalledWith(AvailableHooks.ON_SCORER_RUN, {
      scorer: {
        id: params.scorerId,
        name: scorerObject.scorer.name,
        description: scorerObject.scorer.description,
      },
      input: params.input,
      output: params.output,
      runtimeContext: Object.fromEntries(params.runtimeContext),
      runId: params.runId,
      source: params.source,
      entity: params.entity,
      structuredOutput: params.structuredOutput,
      entityType: params.entityType,
      threadId: params.threadId,
      resourceId: params.resourceId,
      tracingContext: params.tracingContext,
    });
  });

  it('sampling null: should execute hook with complete payload', () => {
    // Arrange: Create scorer object with null sampling
    const scorerObject = makeScorerObject();
    scorerObject.sampling = null;
    const params = makeRunScorerParams(scorerObject);

    // Act: Call runScorer with null sampling
    runScorer(params);

    // Assert: Verify hook execution and payload structure
    expect(executeHook).toHaveBeenCalledTimes(1);
    expect(executeHook).toHaveBeenCalledWith(AvailableHooks.ON_SCORER_RUN, {
      scorer: {
        id: params.scorerId,
        name: scorerObject.scorer.name,
        description: scorerObject.scorer.description,
      },
      input: params.input,
      output: params.output,
      runtimeContext: Object.fromEntries(params.runtimeContext),
      runId: params.runId,
      source: params.source,
      entity: params.entity,
      structuredOutput: params.structuredOutput,
      entityType: params.entityType,
      threadId: params.threadId,
      resourceId: params.resourceId,
      tracingContext: params.tracingContext,
    });
  });
});
