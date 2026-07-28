import { describe, expect, it, vi } from 'vitest';
import type { MastraOpRequest, MastraOpResponse } from '../types';
import { runMastraGraph, suspendToken, type MastraStreamEventLike, type WalkerEffects } from './walker';

/**
 * Unit tests for the graph walk, with every effect stubbed.
 *
 * The walker is deliberately import-free so it can be driven like this — no
 * workflow runtime, no `@mastra/core`, just a serialized graph in and a
 * recorded sequence of ops out. The end-to-end behaviour is covered separately
 * in `integration/`.
 */

/** Mirrors the identity string the host executor produces. */
function identityFor(request: MastraOpRequest, resolvedId: string): string {
  return `${request.op.kind}@${request.op.path.join('.')}#${resolvedId}`;
}

interface HarnessOptions {
  /** Resolves the id the host would report for an op, mirroring the real graph. */
  resolveId: (request: MastraOpRequest) => string;
  /** Produces the outcome for an op. Defaults to echoing the input. */
  respond?: (request: MastraOpRequest) => Partial<MastraOpResponse> | undefined;
}

function harness({ resolveId, respond }: HarnessOptions) {
  const ops: MastraOpRequest[] = [];
  const events: MastraStreamEventLike[] = [];
  const sleeps: number[] = [];
  const resumes: string[] = [];

  const effects: WalkerEffects = {
    async runOp(request) {
      ops.push(structuredClone(request));
      const base = {
        identity: identityFor(request, resolveId(request)),
        state: request.state,
        startedAt: 0,
        endedAt: 1,
      };
      const override = respond?.(request);
      return { status: 'success', output: request.inputData, ...base, ...override } as MastraOpResponse;
    },
    async sleepMs(ms) {
      sleeps.push(ms);
    },
    async awaitResume(token, onRegistered) {
      resumes.push(token);
      await onRegistered();
      return { approved: true };
    },
    async emit(batch) {
      events.push(...batch);
    },
  };

  return { effects, ops, events, sleeps, resumes };
}

const baseParams = {
  workflowId: 'wf',
  runId: 'run-1',
  inputData: { value: 1 },
  initialState: {},
  requestContext: [] as [string, unknown][],
};

describe('runMastraGraph', () => {
  it('threads each step output into the next and reports success', async () => {
    const { effects, ops } = harness({
      resolveId: request => (request.op.path[0] === 0 ? 'first' : 'second'),
      respond: request => ({
        status: 'success',
        output: { value: (request.inputData as { value: number }).value + 1 },
      }),
    });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [
          { type: 'step', step: { id: 'first' } },
          { type: 'step', step: { id: 'second' } },
        ],
      },
      effects,
    );

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ value: 3 });
    expect(ops.map(op => op.inputData)).toEqual([{ value: 1 }, { value: 2 }]);
    expect(result.steps.first).toMatchObject({ status: 'success', output: { value: 2 } });
  });

  it('keys parallel branch outputs by step id', async () => {
    const { effects } = harness({
      resolveId: request => (request.op.path[1] === 0 ? 'left' : 'right'),
      respond: request => ({ status: 'success', output: { branch: request.op.path[1] } }),
    });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [
          {
            type: 'parallel',
            steps: [
              { type: 'step', step: { id: 'left' } },
              { type: 'step', step: { id: 'right' } },
            ],
          },
        ],
      },
      effects,
    );

    expect(result.result).toEqual({ left: { branch: 0 }, right: { branch: 1 } });
  });

  it('runs only the conditional branches whose predicate is truthy', async () => {
    const { effects, ops } = harness({
      resolveId: request =>
        request.op.kind === 'condition'
          ? `condition_${request.op.conditionIndex}`
          : request.op.path[1] === 0
            ? 'yes'
            : 'no',
      respond: request =>
        request.op.kind === 'condition'
          ? { status: 'success', output: request.op.conditionIndex === 0 }
          : { status: 'success', output: { ran: true } },
    });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [
          {
            type: 'conditional',
            steps: [
              { type: 'step', step: { id: 'yes' } },
              { type: 'step', step: { id: 'no' } },
            ],
            serializedConditions: [
              { id: 'c0', fn: '' },
              { id: 'c1', fn: '' },
            ],
          },
        ],
      },
      effects,
    );

    expect(result.result).toEqual({ yes: { ran: true } });
    expect(ops.filter(op => op.op.kind === 'step')).toHaveLength(1);
  });

  it('repeats a dountil loop until the condition holds', async () => {
    const { effects, ops } = harness({
      resolveId: request => (request.op.kind === 'loop-condition' ? 'tick_condition' : 'tick'),
      respond: request => {
        const value = (request.inputData as { value: number }).value;
        return request.op.kind === 'loop-condition'
          ? { status: 'success', output: value >= 3 }
          : { status: 'success', output: { value: value + 1 } };
      },
    });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [
          {
            type: 'loop',
            step: { id: 'tick' },
            serializedCondition: { id: 'tick_condition', fn: '' },
            loopType: 'dountil',
          },
        ],
      },
      effects,
    );

    expect(result.result).toEqual({ value: 3 });
    expect(ops.filter(op => op.op.kind === 'step')).toHaveLength(2);
  });

  it('registers the hook before announcing a suspension', async () => {
    let suspendedOnce = false;
    const { effects, events, resumes } = harness({
      resolveId: () => 'approval',
      respond: request => {
        if (request.resumeData) {
          return { status: 'success', output: { approved: true } };
        }
        suspendedOnce = true;
        return { status: 'suspended', suspendPayload: { question: 'ok?' }, suspendedAt: 5 };
      },
    });

    const result = await runMastraGraph(
      { ...baseParams, serializedStepGraph: [{ type: 'step', step: { id: 'approval' } }] },
      effects,
    );

    expect(suspendedOnce).toBe(true);
    expect(result.status).toBe('success');
    expect(resumes).toEqual([suspendToken('run-1', 'approval')]);

    // A caller that resumes the instant it sees this event must not lose the
    // race against hook registration, so the event has to come after it.
    const suspendedEventIndex = events.findIndex(e => e.type === 'workflow-step-suspended');
    expect(suspendedEventIndex).toBeGreaterThanOrEqual(0);
  });

  it('retries a failed step up to its configured attempts', async () => {
    let attempts = 0;
    const { effects } = harness({
      resolveId: () => 'flaky',
      respond: () => {
        attempts += 1;
        return attempts < 3
          ? { status: 'failed', error: { message: 'boom' } }
          : { status: 'success', output: { ok: true } };
      },
    });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [{ type: 'step', step: { id: 'flaky' } }],
        stepRetries: { flaky: 2 },
      },
      effects,
    );

    expect(attempts).toBe(3);
    expect(result.status).toBe('success');
  });

  it('does not retry an error marked non-retryable', async () => {
    let attempts = 0;
    const { effects } = harness({
      resolveId: () => 'fatal',
      respond: () => {
        attempts += 1;
        return { status: 'failed', error: { message: 'nope', nonRetryable: true } };
      },
    });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [{ type: 'step', step: { id: 'fatal' } }],
        stepRetries: { fatal: 5 },
      },
      effects,
    );

    expect(attempts).toBe(1);
    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('nope');
  });

  it('reports a failed run rather than rejecting', async () => {
    const { effects } = harness({
      resolveId: () => 'boom',
      respond: () => ({ status: 'failed', error: { message: 'kaboom' } }),
    });

    const result = await runMastraGraph(
      { ...baseParams, serializedStepGraph: [{ type: 'step', step: { id: 'boom' } }] },
      effects,
    );

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('kaboom');
  });

  it('sleeps for a static duration without calling the host', async () => {
    const { effects, sleeps, ops } = harness({ resolveId: () => 'unused' });

    await runMastraGraph(
      { ...baseParams, serializedStepGraph: [{ type: 'sleep', id: 's1', duration: 1_000 }] },
      effects,
    );

    expect(sleeps).toEqual([1_000]);
    expect(ops).toHaveLength(0);
  });

  it('rejects a graph entry it does not understand instead of silently skipping it', async () => {
    const { effects } = harness({ resolveId: () => 'unused' });

    const result = await runMastraGraph(
      { ...baseParams, serializedStepGraph: [{ type: 'quantum' } as never] },
      effects,
    );

    expect(result.status).toBe('failed');
    expect(result.error?.message).toMatch(/not yet supported/);
  });

  it('refuses a nested workflow step with an actionable message', async () => {
    const { effects } = harness({ resolveId: () => 'inner' });

    const result = await runMastraGraph(
      {
        ...baseParams,
        serializedStepGraph: [{ type: 'step', step: { id: 'inner', serializedStepFlow: [] } }],
      },
      effects,
    );

    expect(result.status).toBe('failed');
    expect(result.error?.message).toMatch(/Nested workflow step "inner" is not yet supported/);
  });

  it('throws when a replayed result belongs to a different graph node', async () => {
    // Simulates journal drift: the host echoes an identity for a node other
    // than the one the walk is standing on.
    const effects: WalkerEffects = {
      async runOp(request) {
        return {
          status: 'success',
          output: request.inputData,
          identity: 'step@9#somewhere-else',
          state: {},
          startedAt: 0,
          endedAt: 1,
        };
      },
      sleepMs: vi.fn(async () => {}),
      awaitResume: vi.fn(async () => ({})),
      emit: vi.fn(async () => {}),
    };

    const result = await runMastraGraph(
      { ...baseParams, serializedStepGraph: [{ type: 'step', step: { id: 'first' } }] },
      effects,
    );

    expect(result.status).toBe('failed');
    expect(result.error?.message).toMatch(/replay diverged/);
  });

  it('lets the host own state after a step mutates it', async () => {
    const { effects } = harness({
      resolveId: () => 'writer',
      respond: () => ({ status: 'success', output: { ok: true }, state: { seen: 42 } }),
    });

    const result = await runMastraGraph(
      { ...baseParams, serializedStepGraph: [{ type: 'step', step: { id: 'writer' } }] },
      effects,
    );

    expect(result.state).toEqual({ seen: 42 });
  });
});
