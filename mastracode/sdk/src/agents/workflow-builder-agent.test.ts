import { RequestContext } from '@mastra/core/request-context';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { describe, expect, it, vi } from 'vitest';

import { WORKFLOW_AUTHORING_TOOL_IDS } from '../tools/workflows/tool-ids.js';
import { createMastraCodeWorkflowBuilderAgent, workflowBuilderAgent } from './workflow-builder-agent.js';

const mappingGraph = {
  id: 'host-owned-workflow',
  inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
  outputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
  graph: [{ type: 'mapping', id: 'echo-value', mapConfig: { value: { initData: true, path: 'value' } } }],
};

describe('workflowBuilderAgent', () => {
  it('combines shared composition guidance with Mastra Code persistence policy', async () => {
    const instructions = await workflowBuilderAgent.getInstructions();

    expect(instructions).toContain('# Composition procedure');
    expect(instructions).toContain('# The composition rule — schemas MUST match');
    expect(instructions).toContain("# Anti-patterns — don't do these");
    expect(instructions).toContain('# Worked example: foreach — run an agent on each item of a list');
    expect(instructions).toContain('# Shared summary rules');
    expect(instructions).toContain('# Mastra Code authoring policy');
    expect(instructions).toContain('# Mastra Code execution and response protocol');
    expect(instructions).toContain('Success means exactly that `save-workflow` returned');
    expect(instructions).toContain('/workflows run <id> {…}');
    // Helper workflows may be saved before the requested one, in dependency
    // order. A rejected save may be corrected once, but a successful workflow
    // must never be saved again.
    expect(instructions).toContain('save each helper FIRST, one complete definition per call, in dependency order');
    expect(instructions).toContain('A rejected save is not a successful save');
    expect(instructions).toContain('after `save-workflow` returns `{ ok: true, id }`, never save that workflow again');
    expect(instructions).toContain('permanent, user-visible registry entries');
    expect(instructions).not.toContain('# Studio authoring policy');
    expect(instructions).not.toContain('submit-workflow-draft');
  });

  it('keeps the Mastra Code controller model resolver as the default', async () => {
    await expect(workflowBuilderAgent.getModel({ requestContext: new RequestContext() })).rejects.toThrow(
      'this run started without a controller session context',
    );
  });

  it('uses a host model resolver while preserving trusted workflow ownership', async () => {
    const requestContext = new RequestContext();
    requestContext.set('verifiedAuthorId', 'tenant-a');
    const hostModel = new MastraLanguageModelV2Mock();
    const model = vi.fn(({ requestContext }) => {
      expect(requestContext.get('verifiedAuthorId')).toBe('tenant-a');
      return hostModel;
    });
    const resolveAuthorId = vi.fn(({ requestContext }) => requestContext.get('verifiedAuthorId') as string);
    const agent = createMastraCodeWorkflowBuilderAgent({
      model,
      accessPolicy: { resolveAuthorId },
      additionalSurfaceInstructions: '# Host presentation contract\n\nKeep presentation metadata child-simple.',
    });

    const instructions = await agent.getInstructions();
    expect(instructions).toContain('# Composition procedure');
    expect(instructions).toContain('# Mastra Code authoring policy');
    expect(instructions).toContain('# Mastra Code execution and response protocol');
    expect(instructions).toContain('# Host presentation contract\n\nKeep presentation metadata child-simple.');
    expect(instructions.indexOf('# Host presentation contract')).toBeGreaterThan(
      instructions.indexOf('# Mastra Code execution and response protocol'),
    );

    await expect(agent.getModel({ requestContext })).resolves.toMatchObject({
      modelId: hostModel.modelId,
      provider: hostModel.provider,
    });
    expect(model).toHaveBeenCalledWith(expect.objectContaining({ requestContext }));

    const tools = await agent.listTools({ requestContext });
    const addDynamicWorkflow = vi.fn().mockResolvedValue(undefined);
    await expect(
      (tools[WORKFLOW_AUTHORING_TOOL_IDS.saveWorkflow] as any).execute(mappingGraph, {
        mastra: { addDynamicWorkflow },
        requestContext,
      }),
    ).resolves.toEqual({ ok: true, id: 'host-owned-workflow' });
    expect(resolveAuthorId).toHaveBeenCalledWith({ requestContext });
    expect(addDynamicWorkflow).toHaveBeenCalledWith(expect.objectContaining({ id: 'host-owned-workflow' }), {
      authorId: 'tenant-a',
    });
  });
});
