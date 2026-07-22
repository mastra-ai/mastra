import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../../agent';
import { GOAL_STATE_TYPE, GOAL_SCORE_WAITING } from '../../../agent/goal';
import { RequestContext } from '../../../request-context';
import type { GoalObjectiveRecord } from '../../../storage/domains/thread-state/base';
import { createMockModel } from '../../../test-utils/llm-mock';
import { createGoalStep } from './goal-step';

const THREAD_ID = 'thread-1';

/** Minimal in-memory thread-state store matching ResolvedGoalStore. */
function createStore(initial?: GoalObjectiveRecord) {
  const states = new Map<string, GoalObjectiveRecord>();
  if (initial) states.set(`${THREAD_ID}:${GOAL_STATE_TYPE}`, initial);
  return {
    states,
    getState: async ({ threadId, type }: { threadId: string; type: string }) => states.get(`${threadId}:${type}`),
    setState: async ({ threadId, type, value }: { threadId: string; type: string; value: GoalObjectiveRecord }) => {
      states.set(`${threadId}:${type}`, value);
    },
    deleteState: async ({ threadId, type }: { threadId: string; type: string }) => {
      states.delete(`${threadId}:${type}`);
    },
  };
}

function makeRecord(over?: Partial<GoalObjectiveRecord>): GoalObjectiveRecord {
  return {
    objective: 'implement X, then stop and wait for my review',
    status: 'active',
    runsUsed: 0,
    maxRuns: 10,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    ...over,
  };
}

/**
 * Build the goal step with a judge model scripted to emit `decision`, run it
 * once, and return the captured goal chunk + the persisted record.
 */
async function runGoalStep(
  decision: 'done' | 'continue' | 'waiting',
  record: GoalObjectiveRecord,
  opts?: {
    throwingScorer?: boolean;
    throwMessage?: string;
    throwingToolsResolver?: string;
    undefinedJudgeResolver?: boolean;
    dbMessages?: any[];
    useMemory?: boolean;
    scorer?: any;
    stepResult?: any;
    requestContext?: RequestContext;
    judge?: any;
    tools?: any;
  },
) {
  const store = createStore(record);
  const chunks: any[] = [];
  const messages: any[] = [];
  const dataParts: any[] = [];
  const requestContext = opts?.requestContext ?? new RequestContext();

  const mastra: any = {
    generateId: () => `id-${Math.random().toString(36).slice(2)}`,
    getStorage: () => ({
      getStore: (name: string) => {
        if (name === 'workflows') {
          return {
            getWorkflowRunById: vi.fn().mockResolvedValue(null),
            deleteWorkflowRunById: vi.fn().mockResolvedValue(undefined),
            persistWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
          };
        }
        return store;
      },
    }),
    getLogger: () => undefined,
    getServer: () => undefined,
    getMemory: () => undefined,
    getWorkspace: () => undefined,
    getVersionOverrides: () => undefined,
    listGateways: () => [],
    addTool: vi.fn(),
    addProcessor: vi.fn(),
    addProcessorConfiguration: vi.fn(),
    __registerInternalWorkflow: vi.fn(),
    __unregisterInternalWorkflow: vi.fn(),
    __hasInternalWorkflow: vi.fn(),
    __getInternalWorkflow: vi.fn(),
    __getRunScope: vi.fn(),
    __createRunScope: vi.fn(),
    observability: { addScore: vi.fn(), getSelectedInstance: vi.fn() },
  };

  const messageList: any = {
    add: (m: any, source?: string) => messages.push({ ...m, _source: source }),
    addSignal: (signal: any) => {
      const message = signal.toDBMessage();
      messages.push({ ...message, _source: 'input' });
      return signal;
    },
    markResponseMessageBoundary: vi.fn(),
    get: { all: { db: () => opts?.dbMessages ?? [] } },
  };

  // isContinued must start false: a truthy value trips the "mid-tool-loop
  // continuation" gate and the step returns before scoring. The goal gate is
  // what sets it back to true to force another iteration.
  const stepResult: any = opts?.stepResult ?? { isContinued: false };
  const inputData: any = {
    messageId: 'response-1',
    output: { text: 'I did X', toolCalls: [], toolResults: [] },
    stepResult,
  };

  // A custom scorer whose run throws, to exercise the judge-failure path. The
  // goal step accepts a scorer object directly; runSingleScorer wraps the throw
  // into an `errored` result.
  const throwingScorer: any = {
    id: 'goal-scorer',
    name: 'Goal (LLM)',
    run: async () => {
      throw new Error(opts?.throwMessage ?? 'judge model exploded');
    },
  };

  const step = createGoalStep({
    goal: {
      judge:
        opts?.judge ??
        (opts?.undefinedJudgeResolver
          ? () => undefined
          : (createMockModel({
              objectGenerationMode: 'json',
              mockText: { decision, reason: `r:${decision}` },
            }) as any)),
      ...(opts?.throwingScorer ? { scorer: throwingScorer } : {}),
      ...(opts?.scorer ? { scorer: opts.scorer } : {}),
      // A `goal.tools` resolver that throws exercises a resolution-time judge
      // failure (before scoring) — the default scorer resolves tools eagerly.
      ...(opts?.throwingToolsResolver
        ? {
            tools: () => {
              throw new Error(opts.throwingToolsResolver);
            },
          }
        : opts?.tools
          ? { tools: opts.tools }
          : {}),
    },
    messageList,
    requestContext,
    mastra,
    controller: { enqueue: (c: any) => chunks.push(c) },
    runId: 'run-1',
    outputWriter: async (data: any, options: any) => dataParts.push({ data, options }),
    _internal: {
      generateId: () => 'response-2',
      threadId: THREAD_ID,
      resourceId: 'resource-1',
      ...(opts?.useMemory ? { memory: { id: 'memory' } } : {}),
    },
    agentId: 'agent',
    agentName: 'Agent',
  } as any);

  const executionResult = await (step as any).execute({ inputData });

  // The goal step emits a pending chunk (loading indicator) followed by the
  // final result chunk. Pick the result chunk (non-pending) for assertions.
  const goalChunks = chunks.filter(c => c.type === 'goal');
  const resultChunk = goalChunks.find(c => !c.payload.pending) ?? goalChunks[goalChunks.length - 1];

  return {
    chunk: resultChunk,
    pendingChunk: goalChunks.find(c => c.payload.pending),
    goalChunks,
    record: store.states.get(`${THREAD_ID}:${GOAL_STATE_TYPE}`)!,
    stepResult,
    messages,
    dataParts,
    inputData,
    executionResult,
    requestContext,
  };
}

describe('goal step waiting semantics', () => {
  it('uses the original MastraCode judge prompt shape and memory thread id', async () => {
    const streamSpy = vi.spyOn(Agent.prototype, 'stream').mockResolvedValue({
      object: Promise.resolve({ decision: 'continue', reason: 'need another fact' }),
    } as any);
    try {
      await runGoalStep('continue', makeRecord({ id: 'goal-1' }), {
        useMemory: true,
        dbMessages: [
          {
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Please continue after answering this.' }] },
          },
          {
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Answered the user and kept working.' }] },
          },
        ],
      });

      const [prompt, options] = (streamSpy.mock.calls[0] ?? []) as any[];
      expect(prompt).toBe(
        'Goal: implement X, then stop and wait for my review\n\nLatest user message:\nPlease continue after answering this.\n\nAssistant steps since that user message: 1\n\nLatest assistant message:\nI did X',
      );
      expect(options?.memory?.thread).toEqual({
        id: 'thread-1-goal-1',
        title: 'Goal judge: implement X, then stop and wait for my review',
        metadata: { forkedSubagent: true, goalJudge: true, parentThreadId: THREAD_ID, goalId: 'goal-1' },
      });
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('isolates the default judge request context while preserving inherited values and parent resolver context', async () => {
    const parentMemory = { thread: { id: THREAD_ID }, resource: 'resource-1' };
    const parentContext = new RequestContext();
    parentContext.set('tenantId', 'tenant-1');
    parentContext.set('MastraMemory', parentMemory);
    const judgeModel = createMockModel({ objectGenerationMode: 'json', mockText: 'unused' });
    const judgeResolver = vi.fn(({ requestContext }: { requestContext: RequestContext }) => {
      expect(requestContext).toBe(parentContext);
      return judgeModel;
    });
    const toolsResolver = vi.fn(({ requestContext }: { requestContext: RequestContext }) => {
      expect(requestContext).toBe(parentContext);
      return {};
    });
    let judgeContext: RequestContext | undefined;
    const streamSpy = vi.spyOn(Agent.prototype, 'stream').mockImplementation((async (
      _prompt: unknown,
      options: any,
    ) => {
      judgeContext = options.requestContext;
      judgeContext!.set('MastraMemory', { thread: { id: `${THREAD_ID}-goal-1` }, resource: 'resource-1' });
      return { object: Promise.resolve({ decision: 'waiting', reason: 'need user input' }) } as any;
    }) as any);

    try {
      const { record } = await runGoalStep('waiting', makeRecord({ id: 'goal-1' }), {
        requestContext: parentContext,
        judge: judgeResolver,
        tools: toolsResolver,
        useMemory: true,
      });

      expect(record.status).toBe('active');
      expect(judgeResolver).toHaveBeenCalledOnce();
      expect(toolsResolver).toHaveBeenCalledOnce();
      expect(judgeContext).toBeInstanceOf(RequestContext);
      expect(judgeContext).not.toBe(parentContext);
      expect(judgeContext?.get('tenantId')).toBe('tenant-1');
      expect(judgeContext?.get('MastraMemory')).toEqual({
        thread: { id: `${THREAD_ID}-goal-1` },
        resource: 'resource-1',
      });
      expect(parentContext.get('MastraMemory')).toBe(parentMemory);
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('keeps judge request-context mutations isolated when default judge execution fails', async () => {
    const parentMemory = { thread: { id: THREAD_ID }, resource: 'resource-1' };
    const parentContext = new RequestContext();
    parentContext.set('tenantId', 'tenant-1');
    parentContext.set('MastraMemory', parentMemory);
    let judgeContext: RequestContext | undefined;
    const streamSpy = vi.spyOn(Agent.prototype, 'stream').mockImplementation((async (
      _prompt: unknown,
      options: any,
    ) => {
      judgeContext = options.requestContext;
      judgeContext!.set('MastraMemory', { thread: { id: `${THREAD_ID}-goal-1` }, resource: 'resource-1' });
      throw new Error('judge model exploded');
    }) as any);

    try {
      const { record, chunk } = await runGoalStep('done', makeRecord({ id: 'goal-1' }), {
        requestContext: parentContext,
        useMemory: true,
      });

      expect(record.status).toBe('paused');
      expect(chunk.payload.judgeFailed).toBe(true);
      expect(judgeContext).not.toBe(parentContext);
      expect(judgeContext?.get('tenantId')).toBe('tenant-1');
      expect(parentContext.get('MastraMemory')).toBe(parentMemory);
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('emits judge activity chunks while scoring runs', async () => {
    const streamSpy = vi.spyOn(Agent.prototype, 'stream').mockImplementation((async () => {
      return {
        object: Promise.resolve({ decision: 'continue', reason: 'need verification' }),
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call',
              payload: { toolName: 'view', args: { path: 'packages/core/src/agent/goal/scorer.ts' } },
            });
            controller.enqueue({
              type: 'tool-result',
              payload: { toolName: 'view', args: { path: 'packages/core/src/agent/goal/scorer.ts' } },
            });
            controller.enqueue({
              type: 'text-delta',
              payload: { id: 'judge-text', text: '{"decision":"continue","reason":"need' },
            });
            controller.enqueue({ type: 'text-delta', payload: { id: 'judge-text', text: ' verification"}' } });
            controller.close();
          },
        }),
      } as any;
    }) as any);
    try {
      const { goalChunks } = await runGoalStep('continue', makeRecord({ id: 'goal-1' }));

      await vi.waitFor(() => {
        const activityChunks = goalChunks.filter(c => c.payload.activity?.length);
        expect(activityChunks.map(c => c.payload.activity[0])).toEqual([
          { type: 'tool-call', name: 'read', message: 'read packages/core/src/agent/goal/scorer.ts' },
          { type: 'reason', message: 'need' },
          { type: 'reason', message: 'need verification' },
        ]);
      });
      expect(goalChunks[0].payload.pending).toBe(true);
      expect(goalChunks.at(-1)?.payload.pending).toBeFalsy();
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('keeps the objective active but stops the loop on a waiting decision', async () => {
    const { chunk, record, stepResult } = await runGoalStep('waiting', makeRecord());

    // The record stays active — the goal is still eligible for judging on the
    // next agent turn. Only the auto-loop stops.
    expect(record.status).toBe('active');
    expect(record.runsUsed).toBe(1);
    // Waiting must stop the loop, not iterate.
    expect(stepResult.isContinued).toBe(false);
    // The chunk reflects active status with the waitingForUser flag.
    expect(chunk.payload.status).toBe('active');
    expect(chunk.payload.waitingForUser).toBe(true);
    expect(chunk.payload.passed).toBe(false);
    // The waiting reason from the judge flows through to the chunk.
    expect(chunk.payload.reason).toBe('r:waiting');
    // It scored the waiting signal (visible on the per-scorer result).
    expect(chunk.payload.results.some((r: any) => r.score === GOAL_SCORE_WAITING)).toBe(true);
  });

  it('falls back to the objective judge when a dynamic judge resolver returns undefined', async () => {
    const fallbackJudge = createMockModel({
      objectGenerationMode: 'json',
      mockText: { decision: 'done', reason: 'fallback judge resolved' },
    });
    const { record, chunk } = await runGoalStep('done', makeRecord({ judgeModelId: fallbackJudge as any }), {
      undefinedJudgeResolver: true,
    });

    expect(record.status).toBe('done');
    expect(chunk.payload.reason).toBe('fallback judge resolved');
  });

  it('marks the objective done and stops the loop on a done decision', async () => {
    const { record, stepResult, chunk } = await runGoalStep('done', makeRecord());

    expect(record.status).toBe('done');
    expect(stepResult.isContinued).toBe(false);
    expect(chunk.payload.passed).toBe(true);
  });

  it('keeps the objective active and continues the loop on a continue decision', async () => {
    const { record, stepResult, chunk } = await runGoalStep('continue', makeRecord());

    expect(record.status).toBe('active');
    expect(stepResult.isContinued).toBe(true);
    expect(chunk.payload.passed).toBe(false);
    expect(chunk.payload.status).toBe('active');
  });

  it('preserves a terminal primary-agent error without judging or emitting goal progress', async () => {
    const initialRecord = makeRecord({ id: 'goal-error', runsUsed: 4 });
    const terminalStepResult = { reason: 'error', isContinued: false };
    const scorerRun = vi.fn().mockResolvedValue({ score: 0, reason: 'keep working' });

    const result = await runGoalStep('continue', initialRecord, {
      scorer: { id: 'goal-scorer', name: 'Goal (LLM)', run: scorerRun },
      stepResult: terminalStepResult,
    });

    expect(scorerRun).not.toHaveBeenCalled();
    expect(result.goalChunks).toEqual([]);
    expect(result.messages).toEqual([]);
    expect(result.dataParts).toEqual([]);
    expect(result.record).toEqual(initialRecord);
    expect(result.stepResult).toBe(terminalStepResult);
    expect(result.stepResult).toEqual({ reason: 'error', isContinued: false });
    expect(result.executionResult).toBe(result.inputData);
  });

  it('persists waiting feedback as a goal-judge signal, not assistant-authored transcript text', async () => {
    const { messages, chunk } = await runGoalStep('waiting', makeRecord());

    expect(messages).toHaveLength(1);
    expect(messages[0]._source).toBe('input');
    expect(messages[0].role).toBe('signal');
    expect(messages[0].content.metadata.signal.attributes).toEqual({ type: 'goal-judge' });
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation.waitingForUser).toBe(true);
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation.reason).toBe('r:waiting');
    expect(chunk.payload.waitingForUser).toBe(true);
    expect(chunk.payload.reason).toBe('r:waiting');
  });

  it('persists pausedReason only while parked (paused), not for waiting or active', async () => {
    // Waiting keeps the record active, so no pausedReason is persisted.
    const waitingResult = await runGoalStep('waiting', makeRecord());
    expect(waitingResult.record.pausedReason).toBeUndefined();

    const active = await runGoalStep('continue', makeRecord());
    expect(active.record.pausedReason).toBeUndefined();

    const done = await runGoalStep('done', makeRecord());
    expect(done.record.pausedReason).toBeUndefined();
  });

  it('emits a goal-judge signal through the current loop signal path on continue', async () => {
    const { messages, dataParts, inputData } = await runGoalStep('continue', makeRecord({ runsUsed: 1, maxRuns: 10 }));

    expect(messages).toHaveLength(1);
    expect(messages[0]._source).toBe('input');
    expect(messages[0].role).toBe('signal');
    expect(messages[0].content.metadata.signal.attributes).toEqual({ type: 'goal-judge' });
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation).toMatchObject({
      iteration: 2,
      maxRuns: 10,
      status: 'active',
      passed: false,
      reason: 'r:continue',
    });
    expect(messages[0].content.parts[0].text).toBe(
      '[Goal attempt 2/10] The goal is not yet complete. Judge feedback: r:continue\n\nContinue working toward the goal: implement X, then stop and wait for my review',
    );
    expect(inputData.messageId).toBe('response-2');
    expect(dataParts).toHaveLength(1);
    expect(dataParts[0].options).toEqual({ messageId: 'response-2' });
    expect(dataParts[0].data.type).toBe('data-signal');
  });

  it('emits a pending chunk before scoring so consumers can show a loading indicator', async () => {
    const { pendingChunk, chunk } = await runGoalStep('continue', makeRecord());

    expect(pendingChunk).toBeDefined();
    expect(pendingChunk.payload.pending).toBe(true);
    expect(pendingChunk.payload.results).toEqual([]);
    // The final chunk should not be pending.
    expect(chunk.payload.pending).toBeUndefined();
  });
});

describe('goal step judge-failure semantics', () => {
  it('pauses the objective and stops the loop when the judge/scorer throws', async () => {
    // The decision the model "would" have returned is irrelevant: the scorer
    // throws before it matters. The step must not treat the error as continue.
    const { record, stepResult, chunk } = await runGoalStep('done', makeRecord(), { throwingScorer: true });

    expect(record.status).toBe('paused');
    expect(record.runsUsed).toBe(1);
    // A failed judge must stop the loop, not silently iterate against it.
    expect(stepResult.isContinued).toBe(false);
    expect(chunk.payload.status).toBe('paused');
    expect(chunk.payload.judgeFailed).toBe(true);
    expect(chunk.payload.passed).toBe(false);
    // The error reason is captured as the pause reason.
    expect(record.pausedReason).toContain('judge model exploded');
    expect(chunk.payload.pausedReason).toContain('judge model exploded');
  });

  it('does not mark a thrown judge as complete even when the score is 0 like "continue"', async () => {
    // Guards the core correctness bug: a thrown scorer reports score 0, which
    // must NOT be conflated with a legitimate "keep working" (continue) result.
    const { record, chunk } = await runGoalStep('continue', makeRecord(), { throwingScorer: true });
    expect(record.status).toBe('paused');
    expect(chunk.payload.judgeFailed).toBe(true);
  });

  it('persists judge failure feedback as a goal-judge signal, not assistant-authored transcript text', async () => {
    const { messages, chunk } = await runGoalStep('done', makeRecord(), { throwingScorer: true });

    expect(messages).toHaveLength(1);
    expect(messages[0]._source).toBe('input');
    expect(messages[0].role).toBe('signal');
    expect(messages[0].content.metadata.signal.attributes).toEqual({ type: 'goal-judge' });
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation.judgeFailed).toBe(true);
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation.reason).toContain('judge model exploded');
    expect(chunk.payload.judgeFailed).toBe(true);
    expect(chunk.payload.reason).toContain('judge model exploded');
  });

  it('stops on the FIRST judge failure instead of iterating toward a large budget (infinite-loop regression)', async () => {
    // Reproduces the reported infinite loop: a judge that keeps returning
    // "Bad Request" with a huge maxRuns (e.g. 500) must pause on the first
    // failure rather than burning a failing judge call every iteration until the
    // budget runs out. The error reason carries the underlying "Bad Request".
    const { record, stepResult, chunk } = await runGoalStep('continue', makeRecord({ runsUsed: 3, maxRuns: 500 }), {
      throwingScorer: true,
      throwMessage: 'Scorer Run Failed: Bad Request',
    });

    // Loop stops immediately (isContinued false) — no march toward 500.
    expect(stepResult.isContinued).toBe(false);
    expect(record.status).toBe('paused');
    // Only the single failed run was consumed (3 → 4), not the whole budget.
    expect(record.runsUsed).toBe(4);
    expect(chunk.payload.judgeFailed).toBe(true);
    // The status drives the TUI label away from "continue" → it renders "paused".
    expect(chunk.payload.status).toBe('paused');
    expect(record.pausedReason).toContain('Bad Request');
    expect(chunk.payload.pausedReason).toContain('Bad Request');
    // The TUI judge display reads `payload.reason`; it must carry the cause so a
    // parked goal isn't rendered as "paused" with no explanation.
    expect(chunk.payload.reason).toContain('Bad Request');
  });

  it('pauses (does not throw or loop) when the judge fails DURING resolution, not just inside scorer.run', async () => {
    // The throw originates in the goal.tools resolver — i.e. before scoring even
    // begins. This used to escape the entire step (the loop had already emitted
    // model output but never set isContinued=false → re-run forever). The step
    // must swallow it and route to the same paused outcome.
    let thrown: unknown;
    let res: Awaited<ReturnType<typeof runGoalStep>> | undefined;
    try {
      res = await runGoalStep('continue', makeRecord({ runsUsed: 3, maxRuns: 500 }), {
        throwingToolsResolver: 'Bad Request',
      });
    } catch (e) {
      thrown = e;
    }

    // The step must NOT throw — the failure is handled internally.
    expect(thrown).toBeUndefined();
    const { record, stepResult, chunk } = res!;
    expect(stepResult.isContinued).toBe(false);
    expect(record.status).toBe('paused');
    expect(record.runsUsed).toBe(4);
    expect(chunk.payload.judgeFailed).toBe(true);
    expect(chunk.payload.status).toBe('paused');
    expect(chunk.payload.reason).toContain('Bad Request');
    expect(record.pausedReason).toContain('Bad Request');
  });
});

describe('goal step budget-exhaustion semantics', () => {
  it('parks the objective as paused with a budget reason and stops when the budget is hit on a continue', async () => {
    // maxRuns 1 + a continue decision exhausts the budget this very run.
    const { record, stepResult, chunk } = await runGoalStep('continue', makeRecord({ maxRuns: 1 }));

    expect(record.status).toBe('paused');
    expect(record.runsUsed).toBe(1);
    expect(record.pausedReason).toContain('budget');
    expect(stepResult.isContinued).toBe(false);
    expect(chunk.payload.status).toBe('paused');
    expect(chunk.payload.maxRunsReached).toBe(true);
    expect(chunk.payload.pausedReason).toContain('budget');
    // Budget exhaustion is not a judge failure.
    expect(chunk.payload.judgeFailed).toBe(false);
  });

  it('lets a done decision on the final allowed run complete rather than read as a budget stall', async () => {
    const { record, chunk } = await runGoalStep('done', makeRecord({ maxRuns: 1 }));
    expect(record.status).toBe('done');
    expect(record.pausedReason).toBeUndefined();
    expect(chunk.payload.passed).toBe(true);
  });

  it('persists budget pause feedback as a goal-judge signal, not assistant-authored transcript text', async () => {
    const { messages, chunk } = await runGoalStep('continue', makeRecord({ maxRuns: 1 }));

    expect(messages).toHaveLength(1);
    expect(messages[0]._source).toBe('input');
    expect(messages[0].role).toBe('signal');
    expect(messages[0].content.metadata.signal.attributes).toEqual({ type: 'goal-judge' });
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation.status).toBe('paused');
    expect(messages[0].content.metadata.signal.metadata.goalEvaluation.reason).toContain('budget');
    expect(chunk.payload.status).toBe('paused');
    expect(chunk.payload.reason).toContain('budget');
  });
});
