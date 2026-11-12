import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import { SpanType, SamplingStrategyType } from '@mastra/core/observability';
import { withSpanErrorAttempt } from '@mastra/core/observability/context-storage';
import { describe, expect, it } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

function tracing() {
  return new DefaultObservabilityInstance({
    name: 'errors',
    serviceName: 'test',
    sampling: { type: SamplingStrategyType.ALWAYS },
    exporters: [],
  });
}

describe('originating error counts', () => {
  it('counts separate failed attempts even when user code rethrows the same Error', () => {
    const obs = tracing();
    const span = obs.startSpan({ name: 'step', type: SpanType.WORKFLOW_STEP });
    const error = new Error('temporarily unavailable');
    for (const attempt of ['first', 'second']) {
      withSpanErrorAttempt(attempt, () => {
        span.recordError?.(error, { occurrenceId: attempt });
        span.recordError?.(error, { occurrenceId: attempt });
      });
    }
    span.end({ outcome: 'success' });
    expect(span.exportSpan()).toMatchObject({ errorCount: 2, outcome: 'success' });
    expect(span.exportSpan()?.errorInfo).toBeUndefined();
  });

  it('keeps nested and concurrent retry scopes separate across async work', async () => {
    const obs = tracing();
    const spans = [0, 1].map(i => obs.startSpan({ name: `step-${i}`, type: SpanType.WORKFLOW_STEP }));
    const failures = spans.map(() => new Error('retryable failure'));
    await Promise.all(
      spans.map((span, index) =>
        withSpanErrorAttempt(`${span.id}:attempt:0`, async () => {
          const outerFailure = new Error('another failure');
          span.recordError?.(outerFailure);
          span.recordError?.(failures[index]!);
          await withSpanErrorAttempt(`${span.id}:attempt:1`, async () => {
            await Promise.resolve();
            span.recordError?.(failures[index]!);
            span.recordError?.(failures[index]!);
          });
          // Restoring the outer context keeps this report a duplicate.
          span.recordError?.(outerFailure);
          span.end();
        }),
      ),
    );
    expect(spans.map(span => span.exportSpan()?.errorCount)).toEqual([3, 3]);
  });

  it('does not attribute an excluded child failure to its visible parent', () => {
    const obs = new DefaultObservabilityInstance({
      name: 'excluded-errors',
      serviceName: 'test',
      exporters: [],
      excludeSpanTypes: [SpanType.TOOL_CALL],
    });
    const parent = obs.startSpan({ name: 'agent', type: SpanType.AGENT_RUN });
    const child = parent.createChildSpan({ name: 'excluded tool', type: SpanType.TOOL_CALL });
    const failure = new Error('tool failed');
    child.error({ error: failure });
    parent.error({ error: new Error('forwarded', { cause: failure }) });
    expect(parent.exportSpan()?.errorCount).toBe(0);
  });

  it('allows an independent failure to reference an earlier cause', () => {
    const obs = tracing();
    const span = obs.startSpan({ name: 'agent', type: SpanType.AGENT_RUN });
    const error = new Error('request failed');
    span.error({ error, endSpan: false });
    span.error({ error: new Error('recovery failed', { cause: error }), origin: 'new' });
    expect(span.exportSpan()?.errorCount).toBe(2);
  });
  it('counts two tool failures and an independent agent failure once each', () => {
    const obs = tracing();
    const agent = obs.startSpan({ name: 'agent', type: SpanType.AGENT_RUN });
    const step = agent.createChildSpan({ name: 'step', type: SpanType.MODEL_STEP });
    const tools = [0, 1].map(i => step.createChildSpan({ name: `tool-${i}`, type: SpanType.TOOL_CALL }));
    const failure = new Error('tool unavailable');
    tools[0]!.error({ error: failure });
    tools[1]!.error({ error: new Error('tool unavailable') });
    const wrapped = new MastraError(
      { id: 'TOOL_FAILED', domain: ErrorDomain.TOOL, category: ErrorCategory.USER },
      failure,
    );
    step.error({ error: wrapped });
    agent.error({ error: wrapped, endSpan: false });
    agent.error({ error: new Error('saving response failed') });
    expect([...tools, step, agent].map(s => s.exportSpan()?.errorCount)).toEqual([1, 1, 0, 1]);
  });

  it('preserves local counts and duplicate reporting through JSON snapshots', () => {
    const obs = tracing();
    const span = obs.startSpan({ name: 'agent', type: SpanType.AGENT_RUN });
    const error = new Error('failed');
    span.error({ error, endSpan: false });
    span.error({ error, endSpan: false });
    const rebuilt = obs.rebuildSpan(JSON.parse(JSON.stringify(span.snapshot())));
    rebuilt.error({ error, endSpan: false });
    rebuilt.error({ error: new Error('another failure') });
    expect(rebuilt.exportSpan()?.errorCount).toBe(2);
    expect(span.exportSpan()?.errorCount).toBe(1);
  });

  it('distinguishes a new error-free span from an old snapshot with unknown accounting', () => {
    const obs = tracing();
    const span = obs.startSpan({ name: 'agent', type: SpanType.AGENT_RUN });
    expect(span.exportSpan()?.errorCount).toBe(0);
    const old = JSON.parse(JSON.stringify(span.snapshot()));
    delete old.errorCount;
    delete old.errorOccurrenceIds;
    const rebuilt = obs.rebuildSpan(old);
    rebuilt.error({ error: new Error('failed') });
    expect(rebuilt.exportSpan()?.errorCount).toBeUndefined();
  });
});
