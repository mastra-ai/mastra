import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from './create';
import { createStep, mapVariable } from './workflow';

/**
 * Regression test for #19018.
 *
 * `.map({ key: mapVariable({ initData: <workflow>, path }) })` used to fall
 * through the map reducer's generic `else` branch, which kept the live
 * `Workflow` instance by reference and then `JSON.stringify`'d it into the map
 * step's `mapConfig` in `serializedStepFlow`. For a real workflow that deep-walk
 * (its `logger`, nested step graph, etc.) materialises a multi-hundred-MB string
 * — and the `.length > 1000` truncation only runs *after* the full string is
 * built, so `.commit()` OOMs before it can trim.
 *
 * The fix serialises a slim `{ initData: <id>, path }` reference instead. The
 * execute path only reads `initData` for truthiness (it calls `getInitData()`),
 * so runtime behaviour is unchanged.
 */
describe('map(): initData mapping does not serialize the live workflow (#19018)', () => {
  const buildInitDataWorkflow = () => {
    const innerStep = createStep({
      id: 'inner',
      inputSchema: z.object({ seed: z.number() }),
      outputSchema: z.object({ seed: z.number() }),
      execute: async ({ inputData }) => inputData,
    });

    const initWorkflow = createWorkflow({
      id: 'init-source-workflow',
      inputSchema: z.object({ seed: z.number() }),
      outputSchema: z.object({ seed: z.number() }),
    })
      .then(innerStep)
      .commit();

    const consumerStep = createStep({
      id: 'consumer',
      inputSchema: z.object({ seed: z.number() }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: async () => ({ ok: true }),
    });

    const workflow = createWorkflow({
      id: 'map-initdata-workflow',
      inputSchema: z.object({ seed: z.number() }),
      outputSchema: z.object({ ok: z.boolean() }),
    })
      .map({
        seed: mapVariable({ initData: initWorkflow as any, path: 'seed' }) as any,
      })
      .then(consumerStep)
      .commit();

    return workflow;
  };

  const mapStepConfig = (workflow: any): string => {
    // Accept either serialization shape produced by the mapping reducer:
    //   • { type: 'step',    step: { id, mapConfig } }   (createStep-wrapped)
    //   • { type: 'mapping', id, mapConfig }             (typed mapping entry)
    const readMapConfig = (e: any): string | undefined => {
      if (typeof e?.step?.mapConfig === 'string') return e.step.mapConfig as string;
      if (e?.type === 'mapping' && typeof e?.mapConfig === 'string') return e.mapConfig as string;
      return undefined;
    };
    const mapEntry = workflow.serializedStepFlow.find((e: any) => {
      const mc = readMapConfig(e);
      return typeof mc === 'string' && mc.includes('initData');
    });
    expect(mapEntry, 'expected a serialized map step with an initData mapConfig').toBeDefined();
    return readMapConfig(mapEntry) as string;
  };

  it('serializes an id reference, not the live Workflow instance', () => {
    const mapConfig = mapStepConfig(buildInitDataWorkflow());

    // The live workflow's internals must not leak into the serialized graph.
    expect(mapConfig).not.toContain('"logger"');
    expect(mapConfig).not.toContain('"component"');
    expect(mapConfig).not.toContain('"stepFlow"');
    expect(mapConfig).not.toContain('"serializedStepFlow"');

    // It should hold the slim reference: the source workflow's id + the path.
    expect(mapConfig).toContain('"initData"');
    expect(mapConfig).toContain('init-source-workflow');
    expect(mapConfig).toContain('"path"');
  });

  it('is small — not the multi-KB blob a serialized workflow produces', () => {
    // Before the fix this map step's config was a giant (truncated-at-1000)
    // dump of the inlined workflow; after, it is a compact reference.
    const mapConfig = mapStepConfig(buildInitDataWorkflow());
    expect(mapConfig.length).toBeLessThan(300);
  });
});
