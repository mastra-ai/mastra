import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createWorkflow, toStorableGraph } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { DynamicWorkflowAccessPolicy } from '../access-policy.js';
import { createWorkflowService } from '../service.js';

const accessPolicy: DynamicWorkflowAccessPolicy = {
  resolveAuthorId: ({ requestContext }) => requestContext.get('verifiedAuthorId') as string | undefined,
};

function requestContext(authorId?: string) {
  const context = new RequestContext();
  if (authorId) context.set('verifiedAuthorId', authorId);
  return context;
}

function definition(id: string) {
  const workflow = createWorkflow({
    id,
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
  })
    .map({ value: { template: '${initData.value}' } })
    .commit();
  return {
    id,
    inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
    outputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
    graph: JSON.parse(JSON.stringify(toStorableGraph(workflow.stepGraph))),
  };
}

function codeWorkflow() {
  return createWorkflow({
    id: 'code-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
  })
    .map({ value: { template: '${initData.value}' } })
    .commit();
}

async function setup() {
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore({ id: 'workflow-access-policy' }),
    workflows: { codeWorkflow: codeWorkflow() },
  });
  await mastra.addDynamicWorkflow(definition('tenant-a-workflow'), { authorId: 'tenant-a' });
  await mastra.addDynamicWorkflow(definition('tenant-b-workflow'), { authorId: 'tenant-b' });
  return mastra;
}

describe('createWorkflowService access policy', () => {
  it('lists and gets only the caller dynamic definitions while retaining code workflow discovery', async () => {
    const mastra = await setup();
    const service = createWorkflowService({ accessPolicy });
    const context = { requestContext: requestContext('tenant-a') };

    await expect(service.listWorkflows(mastra, context)).resolves.toMatchObject({
      workflows: [{ id: 'tenant-a-workflow' }],
      total: 1,
    });
    await expect(service.getWorkflow(mastra, 'tenant-a-workflow', context)).resolves.toMatchObject({
      id: 'tenant-a-workflow',
    });
    await expect(service.getWorkflow(mastra, 'tenant-b-workflow', context)).resolves.toBeNull();

    const registered = await service.listAccessibleRegisteredWorkflows(mastra, context);
    expect(Object.keys(registered)).toContain('codeWorkflow');
    expect(Object.values(registered).map(workflow => workflow.id)).toContain('tenant-a-workflow');
    expect(Object.values(registered).map(workflow => workflow.id)).not.toContain('tenant-b-workflow');
  });

  it('denies cross-owner execution and deletion without disclosing the owner', async () => {
    const mastra = await setup();
    const service = createWorkflowService({ accessPolicy });
    const tenantA = requestContext('tenant-a');

    await expect(service.runWorkflow(mastra, 'tenant-b-workflow', { value: 'secret' }, tenantA)).rejects.toThrow(
      'Dynamic workflow not found.',
    );
    await expect(service.runWorkflow(mastra, 'missing-workflow', { value: 'secret' }, tenantA)).rejects.toThrow(
      'Dynamic workflow not found.',
    );
    await expect(service.deleteWorkflow(mastra, 'tenant-b-workflow', { requestContext: tenantA })).resolves.toEqual({
      ok: true,
      id: 'tenant-b-workflow',
    });
    expect(
      await mastra
        .getStorage()
        ?.getStore('workflowDefinitions')
        .then(store => store?.get('tenant-b-workflow')),
    ).toMatchObject({ authorId: 'tenant-b' });
  });

  it('fails closed for dynamic workflows when the policy cannot resolve a caller', async () => {
    const mastra = await setup();
    const service = createWorkflowService({ accessPolicy });
    const context = { requestContext: requestContext() };

    await expect(service.listWorkflows(mastra, context)).resolves.toEqual({ workflows: [], total: 0 });
    await expect(service.getWorkflow(mastra, 'tenant-a-workflow', context)).resolves.toBeNull();
    await expect(
      service.runWorkflow(mastra, 'tenant-a-workflow', { value: 'secret' }, context.requestContext),
    ).rejects.toThrow('Dynamic workflow not found.');

    const registered = await service.listAccessibleRegisteredWorkflows(mastra, context);
    expect(Object.keys(registered)).toEqual(['codeWorkflow']);

    await expect(service.runWorkflow(mastra, 'codeWorkflow', { value: 'public' })).resolves.toMatchObject({
      status: 'success',
      result: { value: 'public' },
    });
  });
});
