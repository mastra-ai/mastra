/**
 * Round-trip: workflow that uses declarative predicate `.branch()` and
 * `.dowhile()`/`.dountil()` overloads → toStorableGraph → JSON →
 * rehydrateWorkflow → run. Also covers the negative path: closure-based
 * `.branch()` / loop conditions must still hard-fail at serialize time.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { rehydrateWorkflow, toStorableGraph } from '../load-from-storage';
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

describe('predicate round-trip', () => {
  it('branch with declarative predicates round-trips and executes on rehydrated instance', async () => {
    const wf = createWorkflow({
      id: 'branch-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } } }, shoutStep],
        [{ predicate: { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } } }, whisperStep],
      ])
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const conditional = wire.find((e: any) => e.type === 'conditional');
    expect(conditional).toBeDefined();
    expect(conditional.predicates).toHaveLength(2);
    expect(conditional.predicates[0].op).toBe('gt');

    const mastraB = new Mastra({
      logger: false,
      tools: { 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'branch-b' }),
    });
    const { workflow } = await rehydrateWorkflow(
      {
        id: 'branch-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } as any,
        outputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } as any,
        graph: wire,
      },
      mastraB,
    );
    mastraB.addWorkflow(workflow, 'branch-wf');

    const runHigh = await mastraB.getWorkflow('branch-wf').createRun();
    const high = await runHigh.start({ inputData: { value: 42 } });
    expect(high.status).toBe('success');

    const runLow = await mastraB.getWorkflow('branch-wf').createRun();
    const low = await runLow.start({ inputData: { value: 3 } });
    expect(low.status).toBe('success');
  });

  it('dountil with declarative predicate round-trips (serialize shape)', () => {
    const wf = createWorkflow({
      id: 'loop-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .dountil(plusOneStep, {
        predicate: { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 5 } },
      })
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const loop = wire.find((e: any) => e.type === 'loop');
    expect(loop).toBeDefined();
    expect(loop.loopType).toBe('dountil');
    expect(loop.predicate.op).toBe('gte');
  });

  it('branch predicate reading stepResults.<id>.value routes correctly in a live run and after rehydrate', async () => {
    const wf = createWorkflow({
      id: 'stepresults-branch-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .then(plusOneStep)
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'stepResults.plus-one.value' }, right: { literal: 10 } } }, shoutStep],
        [
          { predicate: { op: 'lte', left: { path: 'stepResults.plus-one.value' }, right: { literal: 10 } } },
          whisperStep,
        ],
      ])
      .commit();

    const mastraLive = new Mastra({
      logger: false,
      tools: { 'plus-one': plusOneTool, 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      workflows: { 'stepresults-branch-wf': wf } as any,
      storage: new InMemoryStore({ id: 'stepresults-live' }),
    });

    // value 41 → plus-one → 42 → shout branch (predicate on stepResults.plus-one.value > 10)
    const runHigh = await mastraLive.getWorkflow('stepresults-branch-wf').createRun();
    const high = await runHigh.start({ inputData: { value: 41 } });
    expect(high.status).toBe('success');
    if (high.status === 'success') {
      // shout-tool ran, whisper-tool did not
      expect((high as any).steps['shout-tool']?.status).toBe('success');
      expect((high as any).steps['shout-tool']?.output?.msg).toBe('HIGH:42');
      expect((high as any).steps['whisper-tool']).toBeUndefined();
    }

    // value 2 → plus-one → 3 → whisper branch (predicate on stepResults.plus-one.value <= 10)
    const runLow = await mastraLive.getWorkflow('stepresults-branch-wf').createRun();
    const low = await runLow.start({ inputData: { value: 2 } });
    expect(low.status).toBe('success');
    if (low.status === 'success') {
      expect((low as any).steps['whisper-tool']?.status).toBe('success');
      expect((low as any).steps['whisper-tool']?.output?.msg).toBe('low:3');
      expect((low as any).steps['shout-tool']).toBeUndefined();
    }

    // Round-trip: serialize + rehydrate, then re-run the high branch
    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));

    const mastraRehydrated = new Mastra({
      logger: false,
      tools: { 'plus-one': plusOneTool, 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'stepresults-rehydrated' }),
    });
    const { workflow } = await rehydrateWorkflow(
      {
        id: 'stepresults-branch-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } as any,
        outputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } as any,
        graph: wire,
      },
      mastraRehydrated,
    );
    mastraRehydrated.addWorkflow(workflow, 'stepresults-branch-wf');

    const rehRun = await mastraRehydrated.getWorkflow('stepresults-branch-wf').createRun();
    const reh = await rehRun.start({ inputData: { value: 41 } });
    expect(reh.status).toBe('success');
    if (reh.status === 'success') {
      expect((reh as any).steps['shout-tool']?.output?.msg).toBe('HIGH:42');
      expect((reh as any).steps['whisper-tool']).toBeUndefined();
    }
  });

  it('nested not(and(...)) predicate round-trips and evaluates in both directions', async () => {
    const nested = {
      op: 'not' as const,
      arg: {
        op: 'and' as const,
        args: [
          { op: 'gt' as const, left: { path: 'inputData.value' }, right: { literal: 10 } },
          { op: 'exists' as const, path: 'inputData.foo' },
        ],
      },
    };

    const wf = createWorkflow({
      id: 'nested-predicate-wf',
      inputSchema: z.object({ value: z.number(), foo: z.string().optional() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([
        [{ predicate: nested }, whisperStep],
        // The other branch: NOT(nested) — take the shout branch when the outer NOT is false
        [
          {
            predicate: {
              op: 'and',
              args: [
                { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } },
                { op: 'exists', path: 'inputData.foo' },
              ],
            },
          },
          shoutStep,
        ],
      ])
      .commit();

    // Live stepGraph carries the derived Studio label for the nested predicate
    const liveConditional = wf.serializedStepGraph.find((e: any) => e.type === 'conditional') as any;
    expect(liveConditional).toBeDefined();
    expect(liveConditional.serializedConditions[0].fn).toBeTruthy();
    expect(typeof liveConditional.serializedConditions[0].fn).toBe('string');
    expect(liveConditional.serializedConditions[0].fn.length).toBeGreaterThan(0);

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const conditional = wire.find((e: any) => e.type === 'conditional');
    expect(conditional).toBeDefined();
    // Nested shape survived JSON round-trip
    expect(conditional.predicates[0].op).toBe('not');
    expect(conditional.predicates[0].arg.op).toBe('and');
    expect(conditional.predicates[0].arg.args).toHaveLength(2);

    const mastraN = new Mastra({
      logger: false,
      tools: { 'shout-tool': shoutTool, 'whisper-tool': whisperTool } as any,
      storage: new InMemoryStore({ id: 'nested-pred' }),
    });
    const { workflow } = await rehydrateWorkflow(
      {
        id: 'nested-predicate-wf',
        inputSchema: {
          type: 'object',
          properties: { value: { type: 'number' }, foo: { type: 'string' } },
          required: ['value'],
        } as any,
        outputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } as any,
        graph: wire,
      },
      mastraN,
    );
    mastraN.addWorkflow(workflow, 'nested-predicate-wf');

    // value=42, foo present → inner and(...) is true → not(...) is false → whisper does NOT fire, shout DOES
    const runShout = await mastraN.getWorkflow('nested-predicate-wf').createRun();
    const shoutRes = await runShout.start({ inputData: { value: 42, foo: 'bar' } });
    expect(shoutRes.status).toBe('success');

    // value=3, foo missing → inner and(...) is false → not(...) is true → whisper fires
    const runWhisper = await mastraN.getWorkflow('nested-predicate-wf').createRun();
    const whisperRes = await runWhisper.start({ inputData: { value: 3 } });
    expect(whisperRes.status).toBe('success');
  });

  it('throws when branch uses a closure condition (unstorable)', () => {
    const wf = createWorkflow({
      id: 'closure-branch',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ msg: z.string() }),
    })
      .branch([[async ({ inputData }: { inputData: { value: number } }) => inputData.value > 10, shoutStep]])
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/closure predicates do not round-trip/);
  });

  it('throws when dowhile uses a closure condition (unstorable)', () => {
    const wf = createWorkflow({
      id: 'closure-loop',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .dowhile(plusOneStep, async ({ inputData }: { inputData: { value: number } }) => inputData.value < 5)
      .commit();

    expect(() => toStorableGraph(wf.stepGraph)).toThrow(/closure predicates do not round-trip/);
  });
});
