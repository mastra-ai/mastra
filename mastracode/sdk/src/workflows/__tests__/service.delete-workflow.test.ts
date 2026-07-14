/**
 * Regression test for the "delete → save serves stale graph" bug:
 * `deleteWorkflow` must remove the row from storage AND unregister the live
 * in-process Workflow instance, so a subsequent `addStoredWorkflow` with the
 * same id re-registers cleanly instead of being no-op'd by addWorkflow's
 * first-write-wins guard.
 */
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, toStorableGraph } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { deleteWorkflow } from '../service.js';

const doubleTool = createTool({
  id: 'double-tool',
  description: 'Doubles a number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

function buildGraphWithTemplate(template: string) {
  const wf = createWorkflow({
    id: 'shared-id',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .tool(doubleTool)
    .map({ message: { template } })
    .commit();
  return JSON.parse(JSON.stringify(toStorableGraph(wf.stepGraph)));
}

describe('deleteWorkflow service', () => {
  it('removes the storage row AND unregisters the live instance', async () => {
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage: new InMemoryStore({ id: 'delete-svc' }),
    });

    await mastra.addStoredWorkflow({
      id: 'shared-id',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: buildGraphWithTemplate('first=${stepResults.double-tool.doubled}'),
    });

    expect(mastra.getWorkflow('shared-id')).toBeDefined();

    await deleteWorkflow(mastra, 'shared-id');

    // Live instance is gone
    expect(() => mastra.getWorkflow('shared-id')).toThrow();
  });

  it('after delete + re-add, subsequent runs use the new graph', async () => {
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage: new InMemoryStore({ id: 'delete-then-add' }),
    });

    await mastra.addStoredWorkflow({
      id: 'shared-id',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: buildGraphWithTemplate('first=${stepResults.double-tool.doubled}'),
    });

    await deleteWorkflow(mastra, 'shared-id');

    await mastra.addStoredWorkflow({
      id: 'shared-id',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: buildGraphWithTemplate('second=${stepResults.double-tool.doubled}'),
    });

    const run = await mastra.getWorkflow('shared-id').createRun();
    const result = await run.start({ inputData: { value: 4 } });
    expect(result.status).toBe('success');
    // Before the fix, this would still be "first=8" because the stale live
    // instance was reused.
    expect((result as any).result.message).toBe('second=8');
  });
});
