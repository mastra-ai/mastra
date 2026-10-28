import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { createStep } from '@mastra/core/workflows';
import { expect } from 'vitest';
import { z } from 'zod/v4';
import type { ControlFlowResumeKind, WorkflowOutcomeMode } from './workflow-outcome-fixtures';
export type { WorkflowOutcomeMode } from './workflow-outcome-fixtures';
export {
  workflowOutcomeModes,
  createOutcomeStep,
  controlFlowResumeKinds,
  createResumeSeed,
  createResumeOutcomeStep,
  resumeActions,
  expectedResumeOutcomes,
} from './workflow-outcome-fixtures';

/** Assert exported executions, independently of the transport's public status. */
export function expectWorkflowOutcome(spans: AnyExportedSpan[], mode: WorkflowOutcomeMode) {
  const expected =
    mode === 'error'
      ? { outcome: 'error', stopReason: 'runtime_error' }
      : mode === 'tripwire'
        ? {
            outcome: 'blocked',
            stopReason: 'guardrail',
            stopReasonContext: { tripwire: { reason: 'Policy rejected', processorId: 'policy' } },
          }
        : mode === 'suspend'
          ? { outcome: 'suspend', stopReason: null }
          : { outcome: 'success', stopReason: null };
  const roots = spans.filter(span => span.type === SpanType.WORKFLOW_RUN);
  expect(roots).toHaveLength(1);
  expect(roots[0]).toMatchObject(expected);
  expect(
    spans.findLast(span => span.type === SpanType.WORKFLOW_STEP && span.entityId === `decision-${mode}`),
  ).toMatchObject(expected);
}

/** Nested invocation preserves the child's cause through its wrapper and outer root. */
export function expectNestedWorkflowOutcome(
  spans: AnyExportedSpan[],
  mode: WorkflowOutcomeMode,
  innerId: string,
  remoteParent = false,
) {
  const roots = spans.filter(span => span.type === SpanType.WORKFLOW_RUN);
  expect(roots).toHaveLength(2);
  const inner = roots.find(span => span.entityId === innerId)!;
  const outer = roots.find(span => span.entityId !== innerId)!;
  expectWorkflowOutcome(
    spans.filter(span => span.type !== SpanType.WORKFLOW_RUN || span.id === inner.id),
    mode,
  );
  const expected = { outcome: inner.outcome, stopReason: inner.stopReason, stopReasonContext: inner.stopReasonContext };
  expect(outer).toMatchObject(expected);
  const wrapper = spans.find(span => span.type === SpanType.WORKFLOW_STEP && span.entityId === innerId)!;
  expect(wrapper).toMatchObject({ ...expected, parentSpanId: outer.id, traceId: outer.traceId });
  expect(inner).toMatchObject({
    [remoteParent ? 'externalParentSpanId' : 'parentSpanId']: wrapper.id,
    traceId: outer.traceId,
  });
  expect(spans.map(span => ({ id: span.id, name: span.name }))).toEqual([
    ...new Map(spans.map(span => [span.id, { id: span.id, name: span.name }])).values(),
  ]);
}

/** A resume creates another execution and cannot rewrite the suspended segment. */
export function expectWorkflowSegments(spans: AnyExportedSpan[], originalId: string) {
  const roots = spans.filter(span => span.type === SpanType.WORKFLOW_RUN);
  expect(roots).toHaveLength(2);
  expect(roots[0]).toMatchObject({ id: originalId, outcome: 'suspend', stopReason: null });
  expect(roots[1]).toMatchObject({ outcome: 'success', stopReason: null });
  expect(roots[1]!.id).not.toBe(originalId);
  expect(spans.filter(span => span.type === SpanType.WORKFLOW_STEP).map(span => span.outcome)).toEqual([
    'suspend',
    'success',
  ]);
}

export function expectParallelOutcome(spans: AnyExportedSpan[], mode: WorkflowOutcomeMode, hasBlock = true) {
  expectWorkflowOutcome(spans, mode);
  expect(spans.find(span => span.type === SpanType.WORKFLOW_STEP && span.entityId === 'parallel-peer')).toMatchObject({
    outcome: 'success',
    stopReason: null,
  });
  const root = spans.find(span => span.type === SpanType.WORKFLOW_RUN)!;
  const parallel = spans.filter(span => span.type === SpanType.WORKFLOW_PARALLEL);
  expect(parallel).toHaveLength(hasBlock ? 1 : 0);
  if (!hasBlock) return;
  for (const child of spans.filter(span => span.type === SpanType.WORKFLOW_STEP))
    expect(child.parentSpanId).toBe(parallel[0]!.id);
  expect(parallel[0]!.parentSpanId).toBe(root.id);
  expect(parallel[0]).toMatchObject({
    outcome: root.outcome,
    stopReason: root.stopReason,
    stopReasonContext: root.stopReasonContext,
  });
}

export function expectConditionalOutcome(
  spans: AnyExportedSpan[],
  mode: WorkflowOutcomeMode | 'condition-error',
  hasBlock = true,
) {
  expectWorkflowOutcome(spans, mode === 'condition-error' ? 'success' : mode);
  expect(spans.some(span => span.entityId === 'unselected')).toBe(false);
  const root = spans.find(span => span.type === SpanType.WORKFLOW_RUN)!;
  const blocks = spans.filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL);
  const evaluations = spans.filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
  expect(blocks).toHaveLength(hasBlock ? 1 : 0);
  expect(evaluations).toHaveLength(2);
  if (hasBlock)
    expect(blocks[0]).toMatchObject({
      outcome: root.outcome,
      stopReason: root.stopReason,
      stopReasonContext: root.stopReasonContext,
    });
  if (hasBlock) {
    expect(blocks[0]!.parentSpanId).toBe(root.id);
    for (const child of spans.filter(span => span.type === SpanType.WORKFLOW_STEP))
      expect(child.parentSpanId).toBe(blocks[0]!.id);
  }
  for (const evaluation of evaluations) {
    expect(evaluation.parentSpanId).toBe(hasBlock ? blocks[0]!.id : root.id);
    if (
      mode === 'condition-error' &&
      evaluation.attributes &&
      'conditionIndex' in evaluation.attributes &&
      evaluation.attributes.conditionIndex === 1
    )
      expect(evaluation).toMatchObject({
        outcome: 'error',
        stopReason: 'runtime_error',
        stopReasonContext: { message: expect.stringContaining('Condition failed') },
      });
    else
      expect(evaluation).toMatchObject({
        outcome: 'success',
        stopReason: null,
        output:
          evaluation.attributes &&
          'conditionIndex' in evaluation.attributes &&
          evaluation.attributes.conditionIndex === 0,
      });
  }
}

export function expectLoopOutcome(spans: AnyExportedSpan[], mode: WorkflowOutcomeMode, hasBlock = true) {
  expectWorkflowOutcome(spans, mode);
  const root = spans.find(span => span.type === SpanType.WORKFLOW_RUN)!;
  const blocks = spans.filter(span => span.type === SpanType.WORKFLOW_LOOP);
  const evaluations = spans.filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
  expect(blocks).toHaveLength(hasBlock ? 1 : 0);
  expect(evaluations).toHaveLength(mode === 'success' ? 2 : 0);
  if (hasBlock)
    expect(blocks[0]).toMatchObject({
      outcome: root.outcome,
      stopReason: root.stopReason,
      stopReasonContext: root.stopReasonContext,
    });
  for (const evaluation of evaluations)
    expect(evaluation).toMatchObject({
      outcome: 'success',
      stopReason: null,
      parentSpanId: hasBlock ? blocks[0]!.id : root.id,
    });
  if (hasBlock) {
    expect(blocks[0]?.parentSpanId).toBe(root.id);
    for (const body of spans.filter(span => span.type === SpanType.WORKFLOW_STEP))
      expect(body.parentSpanId).toBe(blocks[0]!.id);
  }
  if (mode === 'success') {
    expect(evaluations).toMatchObject([{ attributes: { conditionIndex: 0 } }, { attributes: { conditionIndex: 1 } }]);
    expect(new Set(evaluations.map(span => span.output))).toEqual(new Set([false, true]));
  }
}

export function createForeachSeed() {
  return createStep({
    id: 'seed-items',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({})),
    execute: async () => [{}, {}, {}],
  });
}

export function expectForeachOutcome(spans: AnyExportedSpan[], mode: WorkflowOutcomeMode, hasBlock = true) {
  expectWorkflowOutcome(spans, mode);
  const items = spans.filter(span => span.type === SpanType.WORKFLOW_STEP && span.entityId === `decision-${mode}`);
  expect(items).toHaveLength(mode === 'success' ? 3 : 2);
  expect(items[0]).toMatchObject({ outcome: 'success', stopReason: null });
  const root = spans.find(span => span.type === SpanType.WORKFLOW_RUN)!;
  const blocks = spans.filter(span => span.type === SpanType.WORKFLOW_LOOP);
  expect(blocks).toHaveLength(hasBlock ? 1 : 0);
  if (hasBlock) {
    for (const item of items) expect(item.parentSpanId).toBe(blocks[0]!.id);
    expect(blocks[0]).toMatchObject({
      outcome: root.outcome,
      stopReason: root.stopReason,
      stopReasonContext: root.stopReasonContext,
    });
  }
}

export function expectLoopConditionFailure(spans: AnyExportedSpan[], hasBlock = true, retriesPredicate = !hasBlock) {
  const failure = { outcome: 'error', stopReason: 'runtime_error' };
  expect(spans.filter(span => span.type === SpanType.WORKFLOW_RUN)).toMatchObject([failure]);
  const bodies = spans.filter(span => span.type === SpanType.WORKFLOW_STEP);
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) expect(body).toMatchObject({ outcome: 'success', stopReason: null });
  const blocks = spans.filter(span => span.type === SpanType.WORKFLOW_LOOP);
  expect(blocks).toHaveLength(hasBlock ? 1 : 0);
  const evaluations = spans.filter(span => span.type === SpanType.WORKFLOW_CONDITIONAL_EVAL);
  if (!retriesPredicate) expect(evaluations).toHaveLength(1);
  else expect(evaluations.length).toBeGreaterThan(0);
  for (const execution of [...blocks, ...evaluations])
    expect(execution).toMatchObject({
      ...failure,
      stopReasonContext: { message: 'Condition failed' },
    });
}

export function expectSleepOutcome(
  spans: AnyExportedSpan[],
  mode: 'success' | 'condition-error',
  recoversCalculation = false,
) {
  const expected =
    mode === 'success' || recoversCalculation
      ? { outcome: 'success', stopReason: null }
      : { outcome: 'error', stopReason: 'runtime_error' };
  expect(spans.filter(span => span.type === SpanType.WORKFLOW_RUN)).toMatchObject([expected]);
  for (const step of spans.filter(span => span.type === SpanType.WORKFLOW_STEP))
    expect(step).toMatchObject({ outcome: 'success', stopReason: null });
  const waits = spans.filter(span => span.type === SpanType.WORKFLOW_SLEEP);
  expect(waits).toHaveLength(1);
  expect(waits[0]).toMatchObject(expected);
}

export function expectControlFlowSegments(
  spans: AnyExportedSpan[],
  kind: ControlFlowResumeKind,
  hasBlock = true,
  outcomes: readonly ('success' | 'error' | 'blocked' | 'suspend')[] = ['suspend', 'success'],
) {
  const roots = spans.filter(span => span.type === SpanType.WORKFLOW_RUN);
  const steps = spans.filter(span => span.type === SpanType.WORKFLOW_STEP && span.entityId === 'decision-suspend');
  const type =
    kind === 'parallel'
      ? SpanType.WORKFLOW_PARALLEL
      : kind === 'conditional'
        ? SpanType.WORKFLOW_CONDITIONAL
        : SpanType.WORKFLOW_LOOP;
  const blocks = spans.filter(span => span.type === type);
  expect(blocks).toHaveLength(hasBlock ? outcomes.length : 0);
  for (const executions of [roots, steps, ...(hasBlock ? [blocks] : [])]) {
    expect(executions.map(span => span.outcome)).toEqual(outcomes);
    expect(new Set(executions.map(span => span.id)).size).toBe(outcomes.length);
    executions.forEach((span, index) => {
      const outcome = outcomes[index];
      expect(span).toMatchObject({
        stopReason: outcome === 'error' ? 'runtime_error' : outcome === 'blocked' ? 'guardrail' : null,
      });
      if (outcome === 'error') expect(span.stopReasonContext).toMatchObject({ message: 'Resumed execution failed' });
      if (outcome === 'blocked')
        expect(span.stopReasonContext).toMatchObject({
          tripwire: { reason: 'Policy rejected', processorId: 'policy' },
        });
    });
  }
  if (hasBlock) {
    expect(blocks.map(span => span.parentSpanId)).toEqual(roots.map(span => span.id));
    expect(steps.map(span => span.parentSpanId)).toEqual(blocks.map(span => span.id));
  }
}
