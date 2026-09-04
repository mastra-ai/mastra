import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

const mappingIdsOf = (wf: { steps: Record<string, unknown> }) =>
  Object.keys(wf.steps).filter(id => id.startsWith('mapping_'));

const makeSteps = () => {
  const s1 = createStep({
    id: 's1',
    inputSchema: z.object({ v: z.number() }),
    outputSchema: z.object({ v: z.number() }),
    execute: async ({ inputData }) => ({ v: inputData.v + 1 }),
  });
  const s2 = createStep({
    id: 's2',
    inputSchema: z.object({ doubled: z.number() }),
    outputSchema: z.object({ out: z.number() }),
    execute: async ({ inputData }) => ({ out: inputData.doubled - 1 }),
  });
  return { s1, s2 };
};

const buildWorkflow = () => {
  const { s1, s2 } = makeSteps();
  return createWorkflow({
    id: 'mapping-determinism-wf',
    inputSchema: z.object({ v: z.number() }),
    outputSchema: z.object({ out: z.number() }),
  })
    .then(s1)
    .map({ doubled: { step: s1, path: 'v' } })
    .then(s2)
    .commit();
};

describe('deterministic mapping ids for unnamed .map()', () => {
  it('mints identical mapping ids across two builds of the same workflow definition', () => {
    const a = mappingIdsOf(buildWorkflow() as any);
    const b = mappingIdsOf(buildWorkflow() as any);
    expect(a).toHaveLength(1);
    expect(a).toEqual(b);
    expect(a[0]).toBe('mapping_mapping-determinism-wf_0');
  });

  it('still honors an explicit stepOptions.id', () => {
    const { s1, s2 } = makeSteps();
    const wf = createWorkflow({
      id: 'mapping-explicit-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ out: z.number() }),
    })
      .then(s1)
      .map({ doubled: { step: s1, path: 'v' } }, { id: 'my-mapping' })
      .then(s2)
      .commit();
    expect((wf as any).steps['my-mapping']).toBeTruthy();
    expect(mappingIdsOf(wf as any)).toHaveLength(0);
  });

  it('mints distinct ids for two unnamed .map() calls in one workflow', () => {
    const { s1 } = makeSteps();
    const s3 = createStep({
      id: 's3',
      inputSchema: z.object({ tripled: z.number() }),
      outputSchema: z.object({ out: z.number() }),
      execute: async ({ inputData }) => ({ out: inputData.tripled }),
    });
    const wf = createWorkflow({
      id: 'mapping-two-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ out: z.number() }),
    })
      .then(s1)
      .map({ doubled: { step: s1, path: 'v' } })
      .map(async ({ inputData }: any) => ({ tripled: inputData.doubled }))
      .then(s3)
      .commit();
    const ids = mappingIdsOf(wf as any);
    expect(ids).toEqual(['mapping_mapping-two-wf_0', 'mapping_mapping-two-wf_1']);
  });

  it('does not collide between a parent workflow and a nested workflow that both use unnamed .map()', () => {
    const { s1, s2 } = makeSteps();

    const nested = createWorkflow({
      id: 'mapping-nested-inner-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ out: z.number() }),
    })
      .then(s1)
      .map({ doubled: { step: s1, path: 'v' } })
      .then(s2)
      .commit();

    const outerFinal = createStep({
      id: 'outer-final',
      inputSchema: z.object({ doubled: z.number() }),
      outputSchema: z.object({ out: z.number() }),
      execute: async ({ inputData }) => ({ out: inputData.doubled }),
    });
    const buildParent = () =>
      createWorkflow({
        id: 'mapping-nested-outer-wf',
        inputSchema: z.object({ v: z.number() }),
        outputSchema: z.object({ out: z.number() }),
      })
        .then(nested)
        .map({ doubled: { step: nested, path: 'out' } })
        .then(outerFinal)
        .commit();

    const parent = buildParent();
    const parentIds = mappingIdsOf(parent as any);
    const nestedIds = mappingIdsOf(nested as any);
    expect(parentIds).toEqual(['mapping_mapping-nested-outer-wf_0']);
    expect(nestedIds).toEqual(['mapping_mapping-nested-inner-wf_0']);
    expect(parentIds[0]).not.toBe(nestedIds[0]);
    // Rebuilding the parent (nested workflow still in the graph) yields the same ids.
    expect(mappingIdsOf(buildParent() as any)).toEqual(parentIds);
  });

  it('never collides an unnamed fallback id with an explicit id in the fallback namespace', () => {
    const { s1 } = makeSteps();
    const s3 = createStep({
      id: 's3',
      inputSchema: z.object({ tripled: z.number() }),
      outputSchema: z.object({ out: z.number() }),
      execute: async ({ inputData }) => ({ out: inputData.tripled }),
    });
    const wf = createWorkflow({
      id: 'mapping-collide-wf',
      inputSchema: z.object({ v: z.number() }),
      outputSchema: z.object({ out: z.number() }),
    })
      .then(s1)
      // Explicit id claims the name the SECOND (unnamed) mapping's ordinal would produce.
      .map({ doubled: { step: s1, path: 'v' } }, { id: 'mapping_mapping-collide-wf_1' })
      .map(async ({ inputData }: any) => ({ tripled: inputData.doubled }))
      .then(s3)
      .commit();
    const ids = mappingIdsOf(wf as any).sort();
    // The unnamed mapping must skip the taken ordinal and land on _2, not overwrite _1.
    expect(ids).toEqual(['mapping_mapping-collide-wf_1', 'mapping_mapping-collide-wf_2']);
    expect(Object.keys((wf as any).steps).filter(id => id.startsWith('mapping_'))).toHaveLength(2);
  });

  it('end-to-end: timeTravel succeeds across a simulated restart and keeps the recorded outputs', async () => {
    const storage = new MockStore();

    const original = buildWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'mapping-determinism-wf': original } });
    const run = await original.createRun();
    const result = await run.start({ inputData: { v: 1 } });
    expect(result.status).toBe('success');

    // Simulate a process restart: rebuild the workflow object from the same code.
    const rebuilt = buildWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'mapping-determinism-wf': rebuilt } });
    const travelRun = await rebuilt.createRun({ runId: run.runId });
    const travelled = await travelRun.timeTravel({ step: 's2' as any });

    expect(travelled.status).toBe('success');
    // The reconstruction must carry the RECORDED outputs, not {} fallbacks.
    expect((travelled as any).steps.s1.output).toEqual({ v: 2 });
    expect((travelled as any).steps.s2.payload).toEqual({ doubled: 2 });
    expect((travelled as any).result).toEqual({ out: 1 });
  });
});
