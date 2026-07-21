/**
 * Fluent-builder unit tests for the declarative predicate DSL overloads on
 * `.branch()`, `.dowhile()`, and `.dountil()`.
 *
 * Focus: assert what the builder writes into `serializedStepFlow` at `.commit()`
 * time — before any storage round-trip — and prove that mixed closure +
 * `{ predicate }` calls coexist correctly. Runtime parity is checked as a
 * belt-and-suspenders companion to the round-trip suite in
 * `predicate-round-trip.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { toStorableGraph } from '../load-from-storage';
import type { Predicate } from '../predicate';
import { createStepFromTool } from '../workflow';

const shoutTool = createTool({
  id: 'shout-tool',
  description: 'shouts',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ msg: z.string() }),
  execute: async ({ value }) => ({ msg: `HIGH:${value}` }),
});

const whisperTool = createTool({
  id: 'whisper-tool',
  description: 'whispers',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ msg: z.string() }),
  execute: async ({ value }) => ({ msg: `low:${value}` }),
});

const plusOneTool = createTool({
  id: 'plus-one',
  description: 'adds 1',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ value }) => ({ value: value + 1 }),
});

const shoutStep = createStepFromTool(shoutTool as any) as any;
const whisperStep = createStepFromTool(whisperTool as any) as any;
const plusOneStep = createStepFromTool(plusOneTool as any) as any;

function findConditional(wf: ReturnType<typeof createWorkflow>) {
  return (wf as any).serializedStepFlow.find((e: any) => e.type === 'conditional') as any;
}

function findLoop(wf: ReturnType<typeof createWorkflow>) {
  return (wf as any).serializedStepFlow.find((e: any) => e.type === 'loop') as any;
}

describe('fluent builder — declarative predicate overloads', () => {
  it('`.branch()` populates the derived label on serializedConditions[i].fn at commit time', () => {
    const pred: Predicate = { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } };
    const wf = createWorkflow({
      id: 'label-branch',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([[{ predicate: pred }, shoutStep]])
      .commit();

    const conditional = findConditional(wf);
    expect(conditional).toBeDefined();
    expect(conditional.serializedConditions).toHaveLength(1);
    expect(conditional.serializedConditions[0].fn).toBe('inputData.value > 10');
    expect(conditional.serializedConditions[0].id).toBe(`${shoutStep.id}-condition`);
    // Predicates array is populated when any tuple is declarative.
    expect(conditional.predicates).toBeDefined();
    expect(conditional.predicates[0]).toEqual(pred);
  });

  it('`.branch()` closure overloads still populate fn with the function.toString() — regression pin', () => {
    const closure = async ({ inputData }: { inputData: { value: number } }) => inputData.value > 10;
    const wf = createWorkflow({
      id: 'label-branch-closure',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([[closure, shoutStep]])
      .commit();

    const conditional = findConditional(wf);
    expect(conditional.serializedConditions[0].fn).toBe(closure.toString());
    // No declarative tuples → predicates key must not be present.
    expect(conditional.predicates).toBeUndefined();
  });

  it('`.branch()` accepts mixed closure + `{ predicate }` tuples and populates both labels correctly', () => {
    const closure = async ({ inputData }: { inputData: { value: number } }) => inputData.value > 10;
    const pred: Predicate = { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } };
    const wf = createWorkflow({
      id: 'label-branch-mixed',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [closure, shoutStep],
        [{ predicate: pred }, whisperStep],
      ])
      .commit();

    const conditional = findConditional(wf);
    expect(conditional.serializedConditions[0].fn).toBe(closure.toString());
    expect(conditional.serializedConditions[1].fn).toBe('inputData.value <= 10');
    // Predicates array is present because at least one tuple is declarative.
    // The closure slot must be `undefined` so downstream serializers can tell
    // which branch cannot be round-tripped.
    expect(conditional.predicates).toBeDefined();
    expect(conditional.predicates[0]).toBeUndefined();
    expect(conditional.predicates[1]).toEqual(pred);
  });

  it('`.branch()` [closure, predicate, closure] keeps predicates[] array-position aligned with serializedConditions[] and is not storable', () => {
    const closureA = async ({ inputData }: { inputData: { value: number } }) => inputData.value < 0;
    const pred: Predicate = { op: 'eq', left: { path: 'inputData.value' }, right: { literal: 0 } };
    const closureC = async ({ inputData }: { inputData: { value: number } }) => inputData.value > 0;

    const extraTool = createTool({
      id: 'extra-tool',
      description: 'echo',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
      execute: async ({ value }) => ({ msg: `x:${value}` }),
    });
    const extraStep = createStepFromTool(extraTool as any) as any;

    const wf = createWorkflow({
      id: 'label-branch-three-way-mixed',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [closureA, shoutStep],
        [{ predicate: pred }, whisperStep],
        [closureC, extraStep],
      ])
      .commit();

    const conditional = findConditional(wf);
    expect(conditional).toBeDefined();
    // Labels: closures serialize as function.toString(); predicate uses derived label.
    expect(conditional.serializedConditions).toHaveLength(3);
    expect(conditional.serializedConditions[0].fn).toBe(closureA.toString());
    expect(conditional.serializedConditions[1].fn).toBe('inputData.value == 0');
    expect(conditional.serializedConditions[2].fn).toBe(closureC.toString());
    // Predicates array positions align: only slot 1 is populated.
    expect(conditional.predicates).toBeDefined();
    expect(conditional.predicates).toHaveLength(3);
    expect(conditional.predicates[0]).toBeUndefined();
    expect(conditional.predicates[1]).toEqual(pred);
    expect(conditional.predicates[2]).toBeUndefined();

    // Mixed graph still contains closures → must not be storable.
    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/closure predicates do not round-trip/);
  });

  it('`.dowhile({ predicate })` populates the derived label on serializedCondition.fn', () => {
    const pred: Predicate = { op: 'lt', left: { path: 'inputData.value' }, right: { literal: 5 } };
    const wf = createWorkflow({
      id: 'label-dowhile',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .dowhile(plusOneStep, { predicate: pred })
      .commit();

    const loop = findLoop(wf);
    expect(loop).toBeDefined();
    expect(loop.loopType).toBe('dowhile');
    expect(loop.serializedCondition.fn).toBe('inputData.value < 5');
    expect(loop.serializedCondition.id).toBe(`${plusOneStep.id}-condition`);
    expect(loop.predicate).toEqual(pred);
  });

  it('`.dountil({ predicate })` populates the derived label on serializedCondition.fn', () => {
    const pred: Predicate = { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 5 } };
    const wf = createWorkflow({
      id: 'label-dountil',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .dountil(plusOneStep, { predicate: pred })
      .commit();

    const loop = findLoop(wf);
    expect(loop.loopType).toBe('dountil');
    expect(loop.serializedCondition.fn).toBe('inputData.value >= 5');
    expect(loop.predicate).toEqual(pred);
  });

  it('nested combinators (and/or/not) produce composed labels at the builder layer', () => {
    const composite: Predicate = {
      op: 'and',
      args: [
        { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 0 } },
        {
          op: 'or',
          args: [
            { op: 'lt', left: { path: 'inputData.value' }, right: { literal: 100 } },
            { op: 'not', arg: { op: 'exists', path: 'inputData.skip' } },
          ],
        },
      ],
    };
    const wf = createWorkflow({
      id: 'label-nested',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([[{ predicate: composite }, shoutStep]])
      .commit();

    const conditional = findConditional(wf);
    // Composite renders with parenthesised sub-groups + explicit AND/OR/NOT
    // separators; the exact string is asserted so the label surface is stable
    // for Studio consumers.
    expect(conditional.serializedConditions[0].fn).toBe(
      'inputData.value > 0 AND (inputData.value < 100 OR (NOT inputData.skip exists))',
    );
    expect(conditional.predicates[0]).toEqual(composite);
  });

  it('runtime evaluation of `{ predicate }` and equivalent closure match on the same input', async () => {
    // Two workflows with the exact same branch logic — one declarative,
    // one closure — must dispatch to the same step for the same input.
    const mastra = new Mastra({
      logger: false,
      tools: { 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'builder-parity' }),
    });

    const declarative = createWorkflow({
      id: 'parity-declarative',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } } }, shoutStep],
        [{ predicate: { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } } }, whisperStep],
      ])
      .commit();

    const closure = createWorkflow({
      id: 'parity-closure',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [async ({ inputData }: { inputData: { value: number } }) => inputData.value > 10, shoutStep],
        [async ({ inputData }: { inputData: { value: number } }) => inputData.value <= 10, whisperStep],
      ])
      .commit();

    mastra.addWorkflow(declarative as any, 'parity-declarative');
    mastra.addWorkflow(closure as any, 'parity-closure');

    for (const value of [42, 3]) {
      const dRun = await mastra.getWorkflow('parity-declarative').createRun();
      const dResult = await dRun.start({ inputData: { value } });
      const cRun = await mastra.getWorkflow('parity-closure').createRun();
      const cResult = await cRun.start({ inputData: { value } });

      expect(dResult.status).toBe('success');
      expect(cResult.status).toBe('success');
      // Both workflows produce results keyed by the executed step's tool id
      // (conditional fan-out result shape). Compare the full result maps.
      expect((dResult as any).result).toEqual((cResult as any).result);
    }
  });
});
