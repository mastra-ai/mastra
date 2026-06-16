import { describe, it, expect } from 'vitest';
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
  opts?: { throwingScorer?: boolean; throwMessage?: string; throwingToolsResolver?: string },
) {
  const store = createStore(record);
  const chunks: any[] = [];
  const messages: any[] = [];

  const mastra: any = {
    generateId: () => `id-${Math.random().toString(36).slice(2)}`,
    getStorage: () => ({ getStore: (_: string) => store }),
  };

  const messageList: any = {
    add: (m: any) => messages.push(m),
    get: { all: { db: () => [] } },
  };

  // isContinued must start false: a truthy value trips the "mid-tool-loop
  // continuation" gate and the step returns before scoring. The goal gate is
  // what sets it back to true to force another iteration.
  const stepResult: any = { isContinued: false };
  const inputData: any = {
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
      judge: createMockModel({ objectGenerationMode: 'json', mockText: { decision, reason: `r:${decision}` } }) as any,
      ...(opts?.throwingScorer ? { scorer: throwingScorer } : {}),
      // A `goal.tools` resolver that throws exercises a resolution-time judge
      // failure (before scoring) — the default scorer resolves tools eagerly.
      ...(opts?.throwingToolsResolver
        ? {
            tools: () => {
              throw new Error(opts.throwingToolsResolver);
            },
          }
        : {}),
    },
    messageList,
    requestContext: new RequestContext(),
    mastra,
    controller: { enqueue: (c: any) => chunks.push(c) },
    runId: 'run-1',
    _internal: { threadId: THREAD_ID },
    agentId: 'agent',
    agentName: 'Agent',
  } as any);

  await (step as any).execute({ inputData });

  return {
    chunk: chunks.find(c => c.type === 'goal'),
    record: store.states.get(`${THREAD_ID}:${GOAL_STATE_TYPE}`)!,
    stepResult,
    messages,
  };
}

describe('goal step waiting semantics', () => {
  it('parks the objective as waiting and stops the loop on a waiting decision', async () => {
    const { chunk, record, stepResult } = await runGoalStep('waiting', makeRecord());

    expect(record.status).toBe('waiting');
    expect(record.runsUsed).toBe(1);
    // Waiting must stop the loop, not iterate.
    expect(stepResult.isContinued).toBe(false);
    // The chunk reflects the waiting status and is not "passed" (goal not done).
    expect(chunk.payload.status).toBe('waiting');
    expect(chunk.payload.passed).toBe(false);
    // The waiting reason from the judge flows through to the chunk.
    expect(chunk.payload.reason).toBe('r:waiting');
    // It scored the waiting signal (visible on the per-scorer result).
    expect(chunk.payload.results.some((r: any) => r.score === GOAL_SCORE_WAITING)).toBe(true);
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

  it('surfaces a "Waiting for the user" note in the transcript feedback on waiting', async () => {
    const { messages } = await runGoalStep('waiting', makeRecord());
    const text = messages
      .flatMap(m => m.content?.parts ?? [])
      .map((p: any) => p.text)
      .join('\n');
    expect(text).toContain('Waiting for the user');
    expect(text).toContain('r:waiting');
  });

  it('persists pausedReason only while parked (paused or waiting)', async () => {
    const waitingResult = await runGoalStep('waiting', makeRecord());
    expect(waitingResult.record.pausedReason).toBeTruthy();

    const active = await runGoalStep('continue', makeRecord());
    expect(active.record.pausedReason).toBeUndefined();

    const done = await runGoalStep('done', makeRecord());
    expect(done.record.pausedReason).toBeUndefined();
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

  it('surfaces a "judge failed to evaluate" note in the transcript feedback', async () => {
    const { messages } = await runGoalStep('done', makeRecord(), { throwingScorer: true });
    const text = messages
      .flatMap(m => m.content?.parts ?? [])
      .map((p: any) => p.text)
      .join('\n');
    expect(text).toContain('the judge failed to evaluate');
    expect(text).toContain('judge model exploded');
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

  it('surfaces a "Goal paused" budget note in the transcript feedback', async () => {
    const { messages } = await runGoalStep('continue', makeRecord({ maxRuns: 1 }));
    const text = messages
      .flatMap(m => m.content?.parts ?? [])
      .map((p: any) => p.text)
      .join('\n');
    expect(text).toContain('Goal paused');
    expect(text).toContain('budget');
  });
});
