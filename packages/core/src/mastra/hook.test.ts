import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { runScorer } from '../evals/hooks';
import { AvailableHooks, deregisterHook, registerHook } from '../hooks';
import { createObservabilityContext } from '../observability';
import { wrapMastra } from '../observability/context';
import { validateAndSaveScore, createOnScorerHook } from './hooks';

describe('validateAndSaveScore', () => {
  let mockScoresStore: any;
  let mockStorage: any;

  beforeEach(() => {
    mockScoresStore = {
      saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }),
    };
    mockStorage = {
      getStore: vi.fn((domain: string) => {
        if (domain === 'scores') return Promise.resolve(mockScoresStore);
        return Promise.resolve(undefined);
      }),
    };
  });

  it('should validate and save score with correct payload', async () => {
    const sampleScore = {
      runId: 'test-run-id',
      scorerId: 'test-scorer-id',
      entityId: 'test-entity-id',
      score: 0.5,
      source: 'TEST',
      entityType: 'AGENT',
      output: { result: 'test' },
      scorer: { name: 'test-scorer' },
      entity: { id: 'test-entity-id' },
    };

    await validateAndSaveScore(mockStorage, sampleScore);

    // Verify saveScore was called
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'test-run-id',
        scorerId: 'test-scorer-id',
        entityId: 'test-entity-id',
        score: 0.5,
        source: 'TEST',
      }),
    );
  });

  it('should throw an error if missing required fields', async () => {
    const invalidScore = {
      runId: 'test-run-id',
    };

    await expect(validateAndSaveScore(mockStorage, invalidScore)).rejects.toThrow();

    // Verify saveScore was not called
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should filter out invalid fields', async () => {
    const sampleScore = {
      runId: 'test-run-id',
      scorerId: 'test-scorer-id',
      entityId: 'test-entity-id',
      score: 0.5,
      source: 'TEST',
      entityType: 'AGENT',
      output: { result: 'test' },
      scorer: { name: 'test-scorer' },
      entity: { id: 'test-entity-id' },
      invalidField: 'invalid',
    };

    await validateAndSaveScore(mockStorage, sampleScore);

    const expectedScore = {
      runId: 'test-run-id',
      scorerId: 'test-scorer-id',
      entityId: 'test-entity-id',
      score: 0.5,
      source: 'TEST',
      entityType: 'AGENT',
      output: { result: 'test' },
      scorer: { name: 'test-scorer' },
      entity: { id: 'test-entity-id' },
      // invalidField should be removed
    };

    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(expectedScore);
  });
});

describe('createOnScorerHook', () => {
  let mockScoresStore: any;
  let mockStorage: any;
  let mockMastra: any;
  let hook: (hookData: any) => Promise<void>;

  beforeEach(() => {
    mockScoresStore = {
      saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }),
    };
    mockStorage = {
      getStore: vi.fn((domain: string) => {
        if (domain === 'scores') return Promise.resolve(mockScoresStore);
        return Promise.resolve(undefined);
      }),
    };

    mockMastra = {
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getLogger: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        trackException: vi.fn(),
      }),
      getAgentById: vi.fn(),
      getWorkflowById: vi.fn(),
      getScorerById: vi.fn(),
    };

    hook = createOnScorerHook(mockMastra);
  });

  it('should return early if no storage', async () => {
    const mastraWithoutStorage = {
      getStorage: vi.fn().mockReturnValue(null),
      getLogger: vi.fn().mockReturnValue({
        warn: vi.fn(),
        trackException: vi.fn(),
      }),
    };
    const hookWithoutStorage = createOnScorerHook(mastraWithoutStorage as any);

    await hookWithoutStorage({
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE',
      entity: { id: 'test-entity' },
      entityType: 'AGENT',
    });

    // Should not call any storage methods
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should save score', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
      entityId: 'test-entity',
      scorerId: 'test-scorer',
      score: 0.8,
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    // Verify saveScore was called
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 0.8,
        entityId: 'test-entity',
        scorerId: 'test-scorer',
        source: 'LIVE',
      }),
    );
  });

  it('should extract a trajectory from live agent output for trajectory scorers', async () => {
    const output = [
      {
        role: 'assistant',
        content: {
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'weatherTool',
              args: { city: 'London' },
              result: { temperature: 18 },
            },
          ],
          parts: [],
        },
      },
    ];
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'trajectory-scorer' },
      input: [{ role: 'user', content: 'What is the weather?' }],
      output,
      source: 'LIVE' as const,
      entity: { id: 'test-agent' },
      entityType: 'AGENT' as const,
    };
    const mockScorer = {
      id: 'trajectory-scorer',
      name: 'Trajectory scorer',
      type: 'trajectory',
      run: vi.fn(({ output: trajectory }) => {
        if (!trajectory.steps) throw new Error('Expected trajectory output');
        return Promise.resolve({ score: trajectory.steps.length === 1 ? 1 : 0 });
      }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ trajectory: { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockScorer.run).toHaveBeenCalledWith(
      expect.objectContaining({
        output: {
          steps: [
            {
              stepType: 'tool_call',
              name: 'weatherTool',
              toolArgs: { city: 'London' },
              toolResult: { temperature: 18 },
              success: true,
            },
          ],
          rawOutput: output,
        },
      }),
    );
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
  });

  it.each(['agent', undefined])('should preserve live agent output for scorer type %s', async type => {
    const output = [{ role: 'assistant', content: { content: 'Done' } }];
    const mockScorer = {
      id: 'message-scorer',
      name: 'Message scorer',
      type,
      run: vi.fn().mockResolvedValue({ score: 1 }),
    };
    mockMastra.getScorerById.mockReturnValue(mockScorer);

    await hook({
      runId: 'test-run',
      scorer: { id: mockScorer.id },
      input: [],
      output,
      source: 'LIVE',
      entity: { id: 'test-agent' },
      entityType: 'AGENT',
    });

    expect(mockScorer.run.mock.calls[0][0].output).toBe(output);
  });

  it('should preserve an existing trajectory for live agent scoring', async () => {
    const output = { steps: [{ stepType: 'tool_call', name: 'weatherTool', success: true }] };
    const mockScorer = {
      id: 'trajectory-scorer',
      name: 'Trajectory scorer',
      type: 'trajectory',
      run: vi.fn().mockResolvedValue({ score: 1 }),
    };
    mockMastra.getScorerById.mockReturnValue(mockScorer);

    await hook({
      runId: 'test-run',
      scorer: { id: mockScorer.id },
      input: [],
      output,
      source: 'LIVE',
      entity: { id: 'test-agent' },
      entityType: 'AGENT',
    });

    expect(mockScorer.run.mock.calls[0][0].output).toBe(output);
  });

  it('should preserve array output for live workflow trajectory scorers', async () => {
    const output = [{ value: 'step-result' }];
    const mockScorer = {
      id: 'trajectory-scorer',
      name: 'Trajectory scorer',
      type: 'trajectory',
      run: vi.fn().mockResolvedValue({ score: 1 }),
    };
    mockMastra.getWorkflowById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ trajectory: { scorer: mockScorer } }),
    });

    await hook({
      runId: 'test-run',
      scorer: { id: mockScorer.id },
      input: [],
      output,
      source: 'LIVE',
      entity: { id: 'test-workflow' },
      entityType: 'WORKFLOW',
    });

    expect(mockScorer.run.mock.calls[0][0].output).toBe(output);
  });

  it('should pass live span correlation context and metadata into scorer.run', async () => {
    const correlationContext = {
      traceId: 'trace-live',
      spanId: 'span-live',
      entityName: 'agent-run',
      rootEntityName: 'workflow-root',
      source: 'cloud',
      serviceName: 'test-service',
    };

    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-live',
          traceId: 'trace-live',
          isValid: true,
          metadata: { sessionId: 'session-1', inherited: true },
          getCorrelationContext: vi.fn().mockReturnValue(correlationContext),
          observabilityInstance: {
            getExporters: () => [],
          },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockScorer.run).toHaveBeenCalledWith(
      expect.objectContaining({
        scoreSource: 'live',
        targetScope: 'span',
        targetTraceId: 'trace-live',
        targetSpanId: 'span-live',
        targetCorrelationContext: correlationContext,
        targetMetadata: { sessionId: 'session-1', inherited: true },
      }),
    );
  });

  it('correlates the score to the exported ancestor span when the current span is hidden', async () => {
    // Durable agents run scorers inside a workflow whose spans are marked
    // internal and never reach storage. The span itself reports which exported
    // ancestor a signal should reference, so the score must use that rather than
    // the hidden step span's own id (#23465).
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'hidden-step-span',
          traceId: 'trace-live',
          isValid: true,
          getExportedSpanId: vi.fn().mockReturnValue('agent-run-span'),
          observabilityInstance: { getExporters: () => [] },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockScorer.run).toHaveBeenCalledWith(expect.objectContaining({ targetSpanId: 'agent-run-span' }));
    expect(mockScoresStore.saveScore).toHaveBeenCalledWith(expect.objectContaining({ spanId: 'agent-run-span' }));
  });

  it('still saves the score when no exportable ancestor exists', async () => {
    // `undefined` is a valid answer: it omits the span reference rather than
    // pointing it at a span that was never stored. The score itself must survive.
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'test' }],
      output: { result: 'test' },
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'hidden-step-span',
          traceId: 'trace-live',
          isValid: true,
          getExportedSpanId: vi.fn().mockReturnValue(undefined),
          observabilityInstance: { getExporters: () => [] },
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'test-scorer',
      run: vi.fn().mockResolvedValue({ score: 0.8 }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    expect(mockScorer.run).toHaveBeenCalledWith(expect.objectContaining({ targetSpanId: undefined }));
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
  });

  it('should handle scorer not found without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({}), // Empty scorers
    });
    mockMastra.getScorerById.mockReturnValue(null);

    // Confirm it doesn't throw
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should handle scorer run failure without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
    };

    const mockScorer = {
      id: 'test-scorer',
      run: vi.fn().mockRejectedValue(new Error('Scorer failed')),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Confirm it doesn't throw
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('should handle validation errors without throwing', async () => {
    const hookData = {
      runId: 'test-run',
      scorer: { id: 'test-scorer' },
      input: [],
      output: {},
      source: 'LIVE' as const,
      entity: { id: 'test-entity' },
      entityType: 'AGENT' as const,
    };

    const mockScorer = {
      id: 'test-scorer',
      run: vi.fn().mockResolvedValue({
        // Missing required fields that will cause validation to fail
        invalidField: 'invalid',
      }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    // Confirm it doesn't throw even with validation errors
    await expect(hook(hookData)).resolves.not.toThrow();

    // Should not call saveScore due to validation failure
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });

  it('does not publish a ScoreEvent itself — that is MastraScorer.run()`s job', async () => {
    const addScoreSpy = vi.fn().mockResolvedValue(undefined);
    mockMastra.observability = { addScore: addScoreSpy };

    const hookData = {
      runId: 'run-1',
      scorer: { id: 'test-scorer' },
      input: [{ message: 'hi' }],
      output: { result: 'ok' },
      source: 'LIVE' as const,
      entity: { id: 'agent-1' },
      entityType: 'AGENT' as const,
      tracingContext: {
        currentSpan: {
          id: 'span-123',
          traceId: 'trace-abc',
          isValid: true,
          metadata: { sessionId: 'session-789' },
          getCorrelationContext: vi.fn().mockReturnValue({ traceId: 'trace-abc', spanId: 'span-123' }),
        },
      },
    };

    const mockScorer = {
      id: 'test-scorer',
      name: 'Test Scorer',
      run: vi.fn().mockResolvedValue({ score: 0.9, reason: 'great' }),
    };

    mockMastra.getAgentById.mockReturnValue({
      listScorers: vi.fn().mockReturnValue({ 'test-scorer': { scorer: mockScorer } }),
    });

    await hook(hookData);

    // Hook only writes to the legacy scores store. ScoreEvent emission is owned by
    // MastraScorer.run() — emitting again here would double-publish to every exporter.
    expect(addScoreSpy).not.toHaveBeenCalled();
    expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1);
  });
});

/**
 * End-to-end dispatch through the real hook bus.
 *
 * The unit tests above call the hook directly and never set an owner token, so
 * `isScorerHookForMastra` short-circuits to true and they pass even when
 * production drops every score. Durable agents dispatch through a workflow step,
 * whose mastra is a tracing proxy — a distinct object identity from the instance
 * the hook was registered on, which used to make the owner check fail silently
 * (#23465). These tests drive `runScorer` → `executeHook` → `createOnScorerHook`
 * for real, so the owner gate is actually exercised.
 */
describe('createOnScorerHook owner-scoped dispatch', () => {
  let mockScoresStore: any;
  let mockStorage: any;
  let mockMastra: any;
  let mockScorer: any;
  let onScorerHook: (hookData: any) => Promise<void>;

  /** A span that is valid and not a NoOp, so `wrapMastra` really does proxy. */
  const currentSpan = { id: 'step-span', traceId: 'trace-1', isValid: true };

  function makeMastra(scorer: any) {
    return {
      // All four getters are required for `isMastra` to accept the object,
      // which is what makes `wrapMastra` create a proxy rather than pass through.
      getAgent: vi.fn(),
      getAgentById: vi.fn().mockReturnValue(undefined),
      getWorkflow: vi.fn(),
      getWorkflowById: vi.fn(),
      getStorage: vi.fn().mockReturnValue(mockStorage),
      getLogger: vi.fn().mockReturnValue({ error: vi.fn(), warn: vi.fn(), trackException: vi.fn() }),
      getScorerById: vi.fn().mockReturnValue(scorer),
    };
  }

  function scorerArgs(mastra: any) {
    return {
      runId: 'run-1',
      scorerId: 'test-scorer',
      scorerObject: { scorer: { id: 'test-scorer', name: 'Test Scorer', description: 'test' } } as any,
      input: {},
      output: {},
      requestContext: {},
      entity: { id: 'test-entity' },
      structuredOutput: false,
      source: 'LIVE' as const,
      entityType: 'AGENT' as const,
      mastra,
      ...createObservabilityContext({ currentSpan } as any),
    } as any;
  }

  beforeEach(() => {
    mockScoresStore = { saveScore: vi.fn().mockResolvedValue({ score: 'mocked' }) };
    mockStorage = {
      getStore: vi.fn((domain: string) =>
        domain === 'scores' ? Promise.resolve(mockScoresStore) : Promise.resolve(undefined),
      ),
    };
    mockScorer = { id: 'test-scorer', name: 'Test Scorer', run: vi.fn().mockResolvedValue({ score: 0.8 }) };
    mockMastra = makeMastra(mockScorer);

    onScorerHook = createOnScorerHook(mockMastra);
    registerHook(AvailableHooks.ON_SCORER_RUN, onScorerHook);
  });

  afterEach(() => {
    // The emitter is module-level and never drops handlers; leaking one would
    // cross-contaminate later suites and fail the __hookHandlerCount leak tests.
    deregisterHook(AvailableHooks.ON_SCORER_RUN, onScorerHook);
  });

  it('saves a score dispatched with a tracing proxy of the owning Mastra', async () => {
    const proxy = wrapMastra(mockMastra, { currentSpan } as any);
    // Guard: the proxy must be a distinct identity, or this test proves nothing.
    expect(proxy).not.toBe(mockMastra);

    runScorer(scorerArgs(proxy));

    await vi.waitFor(() => expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1));
    expect(mockScorer.run).toHaveBeenCalledTimes(1);
  });

  it('saves a score dispatched with the owning Mastra itself', async () => {
    runScorer(scorerArgs(mockMastra));

    await vi.waitFor(() => expect(mockScoresStore.saveScore).toHaveBeenCalledTimes(1));
  });

  it('drops a score owned by a different Mastra, even through a proxy', async () => {
    const foreignMastra = makeMastra(mockScorer);
    const foreignProxy = wrapMastra(foreignMastra, { currentSpan } as any);

    runScorer(scorerArgs(foreignProxy));

    // executeHook defers via setImmediate, so flush the queue before asserting
    // that nothing happened.
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));

    expect(mockScorer.run).not.toHaveBeenCalled();
    expect(mockScoresStore.saveScore).not.toHaveBeenCalled();
  });
});
