import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { createWorkflow } from '../workflows/create';
import { toStorableGraph } from '../workflows/load-from-storage';
import { Mastra } from './index';

const doubleTool = createTool({
  id: 'double-tool',
  description: 'Doubles a number',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ doubled: z.number() }),
  execute: async ({ value }) => ({ doubled: value * 2 }),
});

function buildWorkflow(template: string) {
  return createWorkflow({
    id: 'wf',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .tool(doubleTool)
    .map({ message: { template } })
    .commit();
}

describe('Mastra.removeWorkflow', () => {
  it('removes a workflow registered by key', () => {
    const wf = buildWorkflow('v=${stepResults.double-tool.doubled}');
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { myWorkflow: wf } as any,
    });

    expect(mastra.getWorkflow('myWorkflow')).toBeDefined();

    const removed = mastra.removeWorkflow('myWorkflow');
    expect(removed).toBe(true);

    expect(() => mastra.getWorkflow('myWorkflow')).toThrow();
  });

  it('removes a workflow by ID when the key differs', () => {
    const wf = buildWorkflow('v=${stepResults.double-tool.doubled}');
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { registeredUnderKey: wf } as any,
    });

    // Sanity: registered under both key and workflow.id 'wf' (getWorkflowById works)
    expect(mastra.getWorkflowById('wf')).toBeDefined();

    // Remove by workflow.id, not key
    const removed = mastra.removeWorkflow('wf');
    expect(removed).toBe(true);

    expect(() => mastra.getWorkflow('registeredUnderKey')).toThrow();
  });

  it('returns false when the workflow does not exist', () => {
    const mastra = new Mastra({ logger: false });
    expect(mastra.removeWorkflow('non-existent-workflow')).toBe(false);
  });

  it('allows re-adding a workflow after removal', () => {
    const originalWf = buildWorkflow('original=${stepResults.double-tool.doubled}');
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { wf: originalWf } as any,
    });

    mastra.removeWorkflow('wf');

    const replacement = buildWorkflow('replacement=${stepResults.double-tool.doubled}');
    mastra.addWorkflow(replacement, 'wf');

    const retrieved = mastra.getWorkflow('wf');
    expect(retrieved).toBeDefined();
    // Serialized graph should reflect the replacement's template
    const stored = toStorableGraph(retrieved.stepGraph);
    const mapping = stored[1] as Extract<(typeof stored)[number], { type: 'mapping' }>;
    const cfg = JSON.parse(mapping.mapConfig) as Record<string, { template: string }>;
    expect(cfg.message.template).toBe('replacement=${stepResults.double-tool.doubled}');
  });
});

describe('Mastra.addStoredWorkflow replaces on re-save', () => {
  it('re-saving the same id with a new graph replaces the live registration', async () => {
    const storage = new InMemoryStore({ id: 're-save' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage,
    });

    // First save: template says "A"
    const graphA = JSON.parse(
      JSON.stringify(toStorableGraph(buildWorkflow('A=${stepResults.double-tool.doubled}').stepGraph)),
    );
    await mastra.addStoredWorkflow({
      id: 'shared-id',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: graphA,
    });

    const runA = await mastra.getWorkflow('shared-id').createRun();
    const resultA = await runA.start({ inputData: { value: 3 } });
    expect(resultA.status).toBe('success');
    expect((resultA as any).result.message).toBe('A=6');

    // Second save with same id but a different template
    const graphB = JSON.parse(
      JSON.stringify(toStorableGraph(buildWorkflow('B=${stepResults.double-tool.doubled}').stepGraph)),
    );
    await mastra.addStoredWorkflow({
      id: 'shared-id',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: graphB,
    });

    const runB = await mastra.getWorkflow('shared-id').createRun();
    const resultB = await runB.start({ inputData: { value: 3 } });
    expect(resultB.status).toBe('success');
    // Before this fix, addWorkflow silently no-op'd and this would still be "A=6".
    expect((resultB as any).result.message).toBe('B=6');
  });
});

describe('Mastra.getWorkflowOrigin', () => {
  it("stamps 'code' for statically declared workflows and clears on remove", () => {
    const wf = buildWorkflow('v=${stepResults.double-tool.doubled}');
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { myWorkflow: wf } as any,
    });

    expect(mastra.getWorkflowOrigin('myWorkflow')).toBe('code');
    // Lookup by workflow id also resolves.
    expect(mastra.getWorkflowOrigin('wf')).toBe('code');

    mastra.removeWorkflow('myWorkflow');
    expect(mastra.getWorkflowOrigin('myWorkflow')).toBeUndefined();
  });

  it("stamps 'stored' for workflows added via addStoredWorkflow", async () => {
    const storage = new InMemoryStore({ id: 'origin-stored' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage,
    });

    const graph = JSON.parse(
      JSON.stringify(toStorableGraph(buildWorkflow('v=${stepResults.double-tool.doubled}').stepGraph)),
    );
    await mastra.addStoredWorkflow({
      id: 'stored-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph,
    });

    expect(mastra.getWorkflowOrigin('stored-wf')).toBe('stored');
    // Origin lives on the workflow instance itself, not in Mastra-side state.
    expect(mastra.getWorkflow('stored-wf' as never).origin).toBe('stored');

    mastra.removeWorkflow('stored-wf');
    expect(mastra.getWorkflowOrigin('stored-wf')).toBeUndefined();
  });

  it('returns undefined for unknown keys', () => {
    const mastra = new Mastra({ logger: false });
    expect(mastra.getWorkflowOrigin('does-not-exist')).toBeUndefined();
  });
});
