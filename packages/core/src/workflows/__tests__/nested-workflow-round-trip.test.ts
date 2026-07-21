/**
 * Round-trip: workflow that references another workflow via `.then(nested)` →
 * toStorableGraph → JSON → rehydrateWorkflow. Covers top-level nesting plus
 * nesting inside parallel / conditional / foreach / loop, cycle detection,
 * missing-ref errors, and out-of-order boot rehydration through
 * `Mastra.addStoredWorkflow`.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { rehydrateWorkflow, toStorableGraph } from '../load-from-storage';
import { createStepFromTool } from '../workflow';

const doubleTool = createTool({
  id: 'double-tool',
  description: 'doubles',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ value }) => ({ value: value * 2 }),
});

const plusOneTool = createTool({
  id: 'plus-one',
  description: 'adds 1',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async ({ value }) => ({ value: value + 1 }),
});

const doubleStep = createStepFromTool(doubleTool as any) as any;
const plusOneStep = createStepFromTool(plusOneTool as any) as any;

/** Simple nested workflow: value → +1 → value. Reusable across tests. */
function makeInnerWorkflow(id = 'inner-wf') {
  return createWorkflow({
    id,
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ value: z.number() }),
  })
    .then(plusOneStep)
    .commit();
}

describe('nested-workflow round-trip', () => {
  it('top-level .then(nestedWorkflow) serializes to type:"workflow" and rehydrates', async () => {
    const inner = makeInnerWorkflow();
    const outer = createWorkflow({
      id: 'outer-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(inner)
      .then(doubleStep)
      .commit();

    // Serialize to storable graph.
    const stored = toStorableGraph(outer.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));

    // The nested workflow entry must be declarative and reference by id,
    // with the nested graph inlined for Studio/API consumers.
    const nestedEntry = wire.find((e: any) => e.type === 'workflow');
    expect(nestedEntry).toBeDefined();
    expect(nestedEntry.workflowId).toBe('inner-wf');
    expect(nestedEntry.id).toBe('inner-wf');
    expect(Array.isArray(nestedEntry.serializedStepFlow)).toBe(true);
    expect(nestedEntry.serializedStepFlow.length).toBeGreaterThan(0);

    // The live wire graph (serializedStepGraph) also inlines the child flow.
    const liveNested = outer.serializedStepGraph.find((e: any) => e.type === 'workflow') as any;
    expect(liveNested?.serializedStepFlow?.length).toBeGreaterThan(0);

    // Rehydrate on a Mastra instance that already has the inner registered.
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      workflows: { 'inner-wf': inner },
      tools: { 'double-tool': doubleTool as any, 'plus-one': plusOneTool as any },
    });
    const { workflow: rehydrated } = await rehydrateWorkflow(
      {
        id: 'outer-wf',
        graph: wire,
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      } as any,
      mastra,
    );
    mastra.addWorkflow(rehydrated as any, 'outer-wf');

    const run = await (mastra as any).getWorkflow('outer-wf').createRun();
    const result = await run.start({ inputData: { value: 5 } });
    expect(result.status).toBe('success');
    // 5 → inner (+1 = 6) → double (×2 = 12).
    if (result.status === 'success') {
      expect((result.result as any).value).toBe(12);
    }
  });

  it('rehydrate throws when the referenced workflowId is not registered', async () => {
    const inner = makeInnerWorkflow('ghost-wf');
    const outer = createWorkflow({
      id: 'outer-ghost',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(inner)
      .commit();
    const stored = toStorableGraph(outer.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));

    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      rehydrateWorkflow(
        {
          id: 'outer-ghost',
          graph: wire,
          inputSchema: { type: 'object' },
          outputSchema: { type: 'object' },
        } as any,
        mastra,
      ),
    ).rejects.toThrow(/ghost-wf/);
  });

  it('addStoredWorkflow rejects self-referencing (cycle)', async () => {
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'self-cycle',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        graph: [
          // self-reference
          { type: 'workflow', id: 'self-cycle', workflowId: 'self-cycle' },
        ],
      } as any),
    ).rejects.toThrow(/refers to itself/);
  });

  it('addStoredWorkflow rejects missing nested workflow reference', async () => {
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any },
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'has-missing',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
        graph: [{ type: 'workflow', id: 'call-missing', workflowId: 'never-registered' }],
      } as any),
    ).rejects.toThrow(/never-registered/);
  });

  it('nested workflow inside .parallel() serializes each child as type:"workflow"', () => {
    const innerA = makeInnerWorkflow('inner-a');
    const innerB = makeInnerWorkflow('inner-b');
    const wf = createWorkflow({
      id: 'parallel-nested-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .parallel([innerA, innerB])
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const parallelEntry = wire.find((e: any) => e.type === 'parallel');
    expect(parallelEntry).toBeDefined();
    expect(parallelEntry.steps).toHaveLength(2);
    expect(parallelEntry.steps[0]).toMatchObject({ type: 'workflow', workflowId: 'inner-a' });
    expect(parallelEntry.steps[1]).toMatchObject({ type: 'workflow', workflowId: 'inner-b' });
  });

  it('nested workflow inside .branch() (declarative predicate) serializes each branch as type:"workflow"', () => {
    const innerHigh = makeInnerWorkflow('inner-high');
    const innerLow = makeInnerWorkflow('inner-low');
    const wf = createWorkflow({
      id: 'conditional-nested-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.any(),
    })
      .branch([
        [{ predicate: { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } } }, innerHigh],
        [{ predicate: { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } } }, innerLow],
      ])
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const cond = wire.find((e: any) => e.type === 'conditional');
    expect(cond).toBeDefined();
    expect(cond.steps).toHaveLength(2);
    expect(cond.steps[0]).toMatchObject({ type: 'workflow', workflowId: 'inner-high' });
    expect(cond.steps[1]).toMatchObject({ type: 'workflow', workflowId: 'inner-low' });
  });

  it('nested workflow inside .foreach() serializes inner step as type:"workflow"', () => {
    const inner = createWorkflow({
      id: 'inner-foreach-body',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .then(plusOneStep)
      .commit();
    const wf = createWorkflow({
      id: 'foreach-nested-wf',
      inputSchema: z.array(z.object({ value: z.number() })),
      outputSchema: z.any(),
    })
      .foreach(inner)
      .commit();
    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const foreach = wire.find((e: any) => e.type === 'foreach');
    expect(foreach).toBeDefined();
    expect(foreach.step).toMatchObject({ type: 'workflow', workflowId: 'inner-foreach-body' });
  });

  it('nested workflow inside .dountil() (declarative predicate) serializes inner step as type:"workflow"', () => {
    const inner = makeInnerWorkflow('inner-loop-body');
    const wf = createWorkflow({
      id: 'loop-nested-wf',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
    })
      .dountil(inner, { predicate: { op: 'gte', left: { path: 'inputData.value' }, right: { literal: 5 } } })
      .commit();

    const stored = toStorableGraph(wf.stepGraph);
    const wire = JSON.parse(JSON.stringify(stored));
    const loop = wire.find((e: any) => e.type === 'loop');
    expect(loop).toBeDefined();
    expect(loop.step).toMatchObject({ type: 'workflow', workflowId: 'inner-loop-body' });
    expect(loop.loopType).toBe('dountil');
  });

  it('out-of-order boot: addStoredWorkflow accepts an already-registered nested ref after another stored def', async () => {
    // First register a stored workflow with no deps.
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      tools: { 'plus-one': plusOneTool as any, 'double-tool': doubleTool as any },
    });
    await mastra.addStoredWorkflow({
      id: 'leaf-stored',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      graph: [{ type: 'tool', id: 'plus', toolId: 'plus-one' }],
    } as any);
    // Then a second stored workflow referencing the first.
    await mastra.addStoredWorkflow({
      id: 'root-stored',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      graph: [
        { type: 'workflow', id: 'leaf-ref', workflowId: 'leaf-stored' },
        { type: 'tool', id: 'double', toolId: 'double-tool' },
      ],
    } as any);
    const root = (mastra as any).getWorkflow('root-stored');
    expect(root).toBeDefined();
    const run = await root.createRun();
    const result = await run.start({ inputData: { value: 4 } });
    expect(result.status).toBe('success');
    // 4 → leaf (+1 = 5) → double (×2 = 10).
    if (result.status === 'success') {
      expect((result.result as any).value).toBe(10);
    }
  });

  it('addStoredWorkflow accepts + registers a nested reference to an already-registered workflow', async () => {
    const inner = makeInnerWorkflow('inner-persist');
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      workflows: { 'inner-persist': inner },
      tools: { 'plus-one': plusOneTool as any, 'double-tool': doubleTool as any },
    });

    await mastra.addStoredWorkflow({
      id: 'outer-persist',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } } },
      graph: [
        { type: 'workflow', id: 'inner-persist', workflowId: 'inner-persist' },
        { type: 'tool', id: 'double', toolId: 'double-tool' },
      ],
    } as any);

    const registered = (mastra as any).getWorkflow('outer-persist');
    expect(registered).toBeDefined();
    const run = await registered.createRun();
    const result = await run.start({ inputData: { value: 3 } });
    expect(result.status).toBe('success');
    // 3 → inner (+1 = 4) → double (×2 = 8).
    if (result.status === 'success') {
      expect((result.result as any).value).toBe(8);
    }
  });
});
