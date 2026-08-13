import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { createWorkflow } from '../workflows/create';
import { toStorableGraph } from '../workflows/dynamic';
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

describe('Mastra.addDynamicWorkflow replaces on re-save', () => {
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
    await mastra.addDynamicWorkflow({
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
    await mastra.addDynamicWorkflow({
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

describe('Mastra.deleteDynamicWorkflow', () => {
  function storedDefinition(id: string, template: string) {
    return {
      id,
      description: template,
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph: JSON.parse(JSON.stringify(toStorableGraph(buildWorkflow(template).stepGraph))),
    };
  }

  it('leaves storage and registry untouched when the expected owner does not match', async () => {
    const storage = new InMemoryStore({ id: 'delete-owner-mismatch' });
    const mastra = new Mastra({ logger: false, tools: { 'double-tool': doubleTool } as any, storage });
    await mastra.addDynamicWorkflow(storedDefinition('owned-wf', 'original'), { authorId: 'author-1' });
    const original = mastra.getWorkflow('owned-wf');

    await expect(mastra.deleteDynamicWorkflow('owned-wf', { authorId: 'author-2' })).resolves.toBe(false);

    expect(mastra.getWorkflow('owned-wf')).toBe(original);
    const store = (await storage.getStore('workflowDefinitions'))!;
    await expect(store.get('owned-wf')).resolves.toMatchObject({ authorId: 'author-1' });
  });

  it('deletes the expected owner from storage before unregistering the dynamic workflow', async () => {
    const storage = new InMemoryStore({ id: 'delete-owner-match' });
    const mastra = new Mastra({ logger: false, tools: { 'double-tool': doubleTool } as any, storage });
    await mastra.addDynamicWorkflow(storedDefinition('owned-wf', 'original'), { authorId: 'author-1' });

    await expect(mastra.deleteDynamicWorkflow('owned-wf', { authorId: 'author-1' })).resolves.toBe(true);

    expect(() => mastra.getWorkflow('owned-wf')).toThrow();
    const store = (await storage.getStore('workflowDefinitions'))!;
    await expect(store.get('owned-wf')).resolves.toBeNull();
  });

  it('never unregisters a code-defined workflow when deleting a same-id stored shadow', async () => {
    const storage = new InMemoryStore({ id: 'delete-code-shadow' });
    const codeWorkflow = buildWorkflow('code');
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      workflows: { wf: codeWorkflow } as any,
      storage,
    });
    const store = (await storage.getStore('workflowDefinitions'))!;
    await store.upsert({ ...storedDefinition('wf', 'shadow'), authorId: 'author-1' } as any);

    await expect(mastra.deleteDynamicWorkflow('wf', { authorId: 'author-1' })).resolves.toBe(true);

    expect(mastra.getWorkflow('wf')).toBe(codeWorkflow);
    await expect(store.get('wf')).resolves.toBeNull();
  });

  it('reports a persisted deletion when no live workflow is registered', async () => {
    const storage = new InMemoryStore({ id: 'delete-storage-only' });
    const mastra = new Mastra({ logger: false, tools: { 'double-tool': doubleTool } as any, storage });
    const store = (await storage.getStore('workflowDefinitions'))!;
    await store.upsert({ ...storedDefinition('stored-only', 'stored'), authorId: 'author-1' } as any);

    await expect(mastra.deleteDynamicWorkflow('stored-only', { authorId: 'author-1' })).resolves.toBe(true);
    await expect(store.get('stored-only')).resolves.toBeNull();
  });

  it('serializes delete with same-id registration so the replacement remains live', async () => {
    const storage = new InMemoryStore({ id: 'delete-registration-race' });
    const mastra = new Mastra({ logger: false, tools: { 'double-tool': doubleTool } as any, storage });
    await mastra.addDynamicWorkflow(storedDefinition('raced-wf', 'original'), { authorId: 'author-1' });

    const store = (await storage.getStore('workflowDefinitions'))!;
    const realDelete = store.delete.bind(store);
    let releaseDelete!: () => void;
    const deleteGate = new Promise<void>(resolve => {
      releaseDelete = resolve;
    });
    let markDeleteEntered!: () => void;
    const deleteEntered = new Promise<void>(resolve => {
      markDeleteEntered = resolve;
    });
    store.delete = (async (...args: Parameters<typeof realDelete>) => {
      markDeleteEntered();
      await deleteGate;
      return realDelete(...args);
    }) as typeof store.delete;

    const deletion = mastra.deleteDynamicWorkflow('raced-wf', { authorId: 'author-1' });
    await deleteEntered;
    const replacement = mastra.addDynamicWorkflow(storedDefinition('raced-wf', 'replacement'), {
      authorId: 'author-1',
    });
    releaseDelete();

    await expect(deletion).resolves.toBe(true);
    await expect(replacement).resolves.toBeUndefined();
    expect(mastra.getWorkflow('raced-wf').description).toBe('replacement');
    await expect(store.get('raced-wf')).resolves.toMatchObject({
      authorId: 'author-1',
      description: 'replacement',
    });
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

  it("stamps 'dynamic' for workflows added via addDynamicWorkflow", async () => {
    const storage = new InMemoryStore({ id: 'origin-stored' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'double-tool': doubleTool } as any,
      storage,
    });

    const graph = JSON.parse(
      JSON.stringify(toStorableGraph(buildWorkflow('v=${stepResults.double-tool.doubled}').stepGraph)),
    );
    await mastra.addDynamicWorkflow({
      id: 'stored-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      graph,
    });

    expect(mastra.getWorkflowOrigin('stored-wf')).toBe('dynamic');
    // Origin lives on the workflow instance itself, not in Mastra-side state.
    expect(mastra.getWorkflow('stored-wf' as never).origin).toBe('dynamic');

    mastra.removeWorkflow('stored-wf');
    expect(mastra.getWorkflowOrigin('stored-wf')).toBeUndefined();
  });

  it('returns undefined for unknown keys', () => {
    const mastra = new Mastra({ logger: false });
    expect(mastra.getWorkflowOrigin('does-not-exist')).toBeUndefined();
  });
});
