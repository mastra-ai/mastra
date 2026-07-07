/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/19018.
 *
 * `workflow.map({ field: mapVariable({ initData: <workflow>, path }) })` used to keep
 * the live `Workflow` instance on the serialized map config. Because `Workflow` extends
 * `MastraBase` (whose `logger`/`component` are enumerable own fields), `JSON.stringify`
 * of that config in `.map()` deep-walked the logger and the entire — possibly
 * self-referential — step graph, ballooning `mapConfig` to ~1GB and OOMing at
 * `.commit()`/module load, before the length-truncation guard could run.
 *
 * The serialized config must store only a lightweight reference (the workflow id), not
 * the instance. The runtime map iterates the original config and reads `initData` for
 * truthiness only (via `getInitData()`), so behavior is unchanged.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep, mapVariable } from './workflow';

const inputSchema = z.object({ cool: z.string() });
const outputSchema = z.object({ mapped: z.string() });

function buildInitDataMapWorkflow(id: string) {
  const step1 = createStep({
    id: `${id}-step1`,
    inputSchema,
    outputSchema: z.object({ done: z.boolean() }),
    execute: async () => ({ done: true }),
  });

  const workflow = createWorkflow({ id, inputSchema, outputSchema });

  // Self-reference on initData is the real-world OOM trigger: the workflow is fed as
  // init-data into its own map step.
  workflow
    .then(step1)
    .map(
      {
        mapped: mapVariable({ initData: workflow, path: 'cool' }) as any,
      },
      { id: 'init-map-step' },
    )
    .commit();

  return workflow;
}

describe('map() initData serialization (issue #19018)', () => {
  it('stores only a reference to the init-data workflow, not the live instance', () => {
    const workflow = buildInitDataMapWorkflow('init-oom-wf');

    const entry = workflow.serializedStepGraph.find(
      (e: any) => e.type === 'step' && e.step?.id === 'init-map-step',
    ) as any;
    expect(entry).toBeDefined();

    const mapConfig: string = entry.step.mapConfig;

    // The whole point: the serialized workflow instance (logger + graph) must not leak in.
    expect(mapConfig).not.toContain('logger');
    expect(mapConfig).not.toContain('"component"');
    // Only a reference (the workflow id) is kept.
    expect(mapConfig).toContain('"initData"');
    expect(mapConfig).toContain('init-oom-wf');
  });

  it('still resolves the mapped field from init data at runtime', async () => {
    const workflow = buildInitDataMapWorkflow('init-runtime-wf');
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'init-runtime-wf': workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { cool: 'hello-from-init' } });

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ mapped: 'hello-from-init' });
    }
  });
});
