/**
 * Round-trip: live workflow → toStorableGraph → JSON → rehydrateWorkflow → run.
 *
 * Stays deterministic (no agents, no LLM) so the test asserts the static
 * subset can be serialized, persisted, and re-materialized on a fresh Mastra
 * instance with identical observable behavior.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { rehydrateWorkflow, toStorableGraph } from '../load-from-storage';

const doubleTool = createTool({
  id: 'double-tool',
  description: 'Doubles a number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

function buildOriginalWorkflow() {
  return createWorkflow({
    id: 'round-trip-wf',
    description: 'tool → map(template)',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .tool(doubleTool)
    .map({
      message: { template: 'Doubled value is ${stepResults.double-tool.doubled}' },
    })
    .commit();
}

describe('storage round-trip', () => {
  it('toStorableGraph emits a fully-JSON-safe shape (no functions, no truncation)', () => {
    const wf = buildOriginalWorkflow();
    const stored = toStorableGraph(wf.stepGraph);

    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ type: 'tool', toolId: 'double-tool' });

    const mapping = stored[1] as Extract<(typeof stored)[number], { type: 'mapping' }>;
    expect(mapping.type).toBe('mapping');
    // JSON-safe — round-trips through JSON.stringify/parse
    expect(() => JSON.parse(JSON.stringify(stored))).not.toThrow();
    // mapConfig contains the literal template (full, untruncated)
    const cfg = JSON.parse(mapping.mapConfig) as Record<string, any>;
    expect(cfg.message.template).toContain('${stepResults.double-tool.doubled}');
  });

  it('rehydrated workflow produces the same output as the original', async () => {
    // 1. Run the original on Mastra A
    const originalWorkflow = buildOriginalWorkflow();
    const mastraA = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { 'round-trip-wf': originalWorkflow } as any,
      storage: new InMemoryStore({ id: 'a' }),
    });
    originalWorkflow.__registerMastra(mastraA);
    const originalRun = await mastraA.getWorkflow('round-trip-wf').createRun();
    const originalResult = await originalRun.start({ inputData: { value: 5 } });
    expect(originalResult.status).toBe('success');

    // 2. Serialize → JSON → rehydrate onto Mastra B (no workflow registered yet)
    const stored = toStorableGraph(buildOriginalWorkflow().stepGraph);
    const def = {
      id: 'round-trip-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: JSON.parse(JSON.stringify(stored)),
    };

    const mastraB = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage: new InMemoryStore({ id: 'b' }),
    });

    const { workflow: rehydrated } = await rehydrateWorkflow(def, mastraB);
    mastraB.addWorkflow(rehydrated, 'round-trip-wf');

    const rehydratedRun = await mastraB.getWorkflow('round-trip-wf').createRun();
    const rehydratedResult = await rehydratedRun.start({ inputData: { value: 5 } });

    expect(rehydratedResult.status).toBe('success');
    expect((rehydratedResult as any).result).toEqual((originalResult as any).result);
    expect((rehydratedResult as any).result.message).toBe('Doubled value is 10');
  });

  it('addStoredWorkflow persists + live-registers; loadStoredWorkflows brings it back on a fresh boot', async () => {
    const storage = new InMemoryStore({ id: 'fresh-store' });

    // First process: build, save via addStoredWorkflow, run.
    {
      const mastra = new Mastra({
        logger: false,
        tools: { 'double-tool': doubleTool } as any,
        storage,
      });
      const stored = toStorableGraph(buildOriginalWorkflow().stepGraph);
      await mastra.addStoredWorkflow({
        id: 'cli-built-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
        graph: JSON.parse(JSON.stringify(stored)),
      });
      // Immediately runnable — no startWorkers() call needed for the live path.
      const run = await mastra.getWorkflow('cli-built-wf').createRun();
      const result = await run.start({ inputData: { value: 7 } });
      expect(result.status).toBe('success');
      expect((result as any).result.message).toBe('Doubled value is 14');
    }

    // Second "process" (new Mastra, same storage): startWorkers() should
    // rehydrate and register the saved workflow automatically.
    {
      const mastra2 = new Mastra({
        logger: false,
        tools: { 'double-tool': doubleTool } as any,
        storage,
      });
      await mastra2.startWorkers();

      const wf = mastra2.getWorkflow('cli-built-wf');
      expect(wf).toBeDefined();

      const run = await wf.createRun();
      const result = await run.start({ inputData: { value: 9 } });
      expect(result.status).toBe('success');
      expect((result as any).result.message).toBe('Doubled value is 18');

      await mastra2.stopWorkers?.();
    }
  });
});
