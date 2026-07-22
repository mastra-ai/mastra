import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { factorySupervisorThreadId } from './service.js';
import { createFactorySupervisorTools } from './tools.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const ORG_ID = 'org-1';

type ExecutableTool = { execute: (input: unknown, context: unknown) => Promise<unknown> };

function supervisorContext(overrides: Partial<{ orgId: string; projectId: string; threadId: string }> = {}) {
  const orgId = overrides.orgId ?? ORG_ID;
  const factoryProjectId = overrides.projectId ?? PROJECT_ID;
  const context = new RequestContext();
  context.set('user', { workosId: 'user-1', organizationId: orgId, name: 'Ada Lovelace' });
  context.set('controller', {
    resourceId: factoryProjectId,
    threadId: overrides.threadId ?? factorySupervisorThreadId(factoryProjectId),
    getState: () => ({
      factoryProjectId,
      factoryOrgId: orgId,
      factorySupervisor: true,
    }),
  });
  return context;
}

async function prepareBoundItem(storage: WorkItemsStorage) {
  return storage.prepareRunStart({
    orgId: ORG_ID,
    userId: 'worker-1',
    factoryProjectId: PROJECT_ID,
    workItem: {
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'issue:1' },
        title: 'Investigate flaky build',
        stages: ['intake'],
      },
    },
    role: 'work',
    session: { sessionId: 'worker-resource', branch: 'factory/work', threadId: 'worker-thread' },
    resourceId: 'worker-resource',
    kickoffKey: 'kickoff-1',
    kickoffMessage: null,
  });
}

async function fixture() {
  const storage = (await createFactoryStorageForTests()).workItems;
  const prepared = await prepareBoundItem(storage);
  const accepted = Promise.resolve({ accepted: true as const, runId: 'run-1' });
  const workerSession = {
    thread: {
      getId: vi.fn(() => 'worker-thread'),
      switch: vi.fn(async () => undefined),
    },
    sendSignal: vi.fn(() => ({ accepted })),
  };
  const controller = { getSessionByResource: vi.fn(async () => workerSession) };
  const approvals = {
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    resolve: vi.fn(),
  };
  const getState = vi.fn(async () => ({
    factoryProjectId: PROJECT_ID,
    totalItems: 1,
    counts: { byBoard: { work: 1 }, byStage: { intake: 1 } },
    pendingApprovals: [],
  }));
  const service = {
    requireProject: vi.fn(async ({ orgId }: { orgId: string }) => {
      if (orgId !== ORG_ID) throw new Error('Factory project not found.');
    }),
    getState,
    workItems: storage,
    approvals,
    controller,
  };
  const audit = { emitAgent: vi.fn(async (_input: Record<string, unknown>) => undefined) };
  return { storage, prepared, workerSession, controller, approvals, service, audit };
}

async function toolsFor(context: RequestContext, built: Awaited<ReturnType<typeof fixture>>) {
  return createFactorySupervisorTools({ requestContext: context, service: built.service as never, audit: built.audit });
}

function execute(tool: ExecutableTool, context: RequestContext, input: unknown) {
  return tool.execute(input, { requestContext: context, agent: { toolCallId: 'tool-1' } });
}

describe('Factory supervisor tools', () => {
  it('exposes tools only in the exact canonical tenant-scoped supervisor session', async () => {
    const built = await fixture();
    const tools = await toolsFor(supervisorContext(), built);
    expect(Object.keys(tools).sort()).toEqual([
      'factory_get_state',
      'factory_get_work_item',
      'factory_list_pending_approvals',
      'factory_resolve_transition_approval',
      'factory_signal_work_item',
    ]);
    await expect(toolsFor(supervisorContext({ threadId: 'other-thread' }), built)).resolves.toEqual({});
    await expect(toolsFor(supervisorContext({ orgId: 'org-other' }), built)).rejects.toThrow(
      'Factory project not found',
    );
  });

  it('queries bounded state and tenant-scoped work-item details', async () => {
    const built = await fixture();
    const context = supervisorContext();
    const tools = await toolsFor(context, built);

    await expect(execute(tools.factory_get_state as ExecutableTool, context, {})).resolves.toMatchObject({
      totalItems: 1,
      pendingApprovals: [],
    });
    await expect(
      execute(tools.factory_get_work_item as ExecutableTool, context, { workItemId: built.prepared.item.id }),
    ).resolves.toMatchObject({
      id: built.prepared.item.id,
      title: 'Investigate flaky build',
      sessionRoles: ['work'],
    });
    await expect(
      execute(tools.factory_get_work_item as ExecutableTool, context, {
        workItemId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow('work item not found');
  });

  it('signals only an active binding and records bounded audit metadata without the message body', async () => {
    const built = await fixture();
    const context = supervisorContext();
    const tools = await toolsFor(context, built);
    const result = await execute(tools.factory_signal_work_item as ExecutableTool, context, {
      workItemId: built.prepared.item.id,
      role: 'work',
      message: 'Please summarize the failing checks.',
    });

    expect(result).toMatchObject({ status: 'accepted', role: 'work', runId: 'run-1' });
    expect(built.workerSession.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'user',
        tagName: 'factory-supervisor-message',
        contents: 'Please summarize the failing checks.',
        attributes: expect.objectContaining({ name: 'Ada Lovelace', workItemId: built.prepared.item.id }),
        ifActive: { attributes: { delivery: 'while-active' } },
        ifIdle: { attributes: { delivery: 'message' } },
      }),
      { requestContext: context },
    );
    const auditInput = built.audit.emitAgent.mock.calls[0]?.[0];
    expect(auditInput?.input).toMatchObject({
      action: 'factory.supervisor.message_sent',
      metadata: { bindingId: built.prepared.binding.id, role: 'work', runId: 'run-1' },
    });
    expect(JSON.stringify(auditInput)).not.toContain('Please summarize');
  });

  it('resolves only pending approvals through the approval service', async () => {
    const built = await fixture();
    const approval = {
      id: '33333333-3333-4333-8333-333333333333',
      orgId: ORG_ID,
      factoryProjectId: PROJECT_ID,
      workItemId: built.prepared.item.id,
      requestedStage: 'planning',
      status: 'pending',
    };
    built.approvals.get.mockResolvedValue(approval as never);
    built.approvals.resolve.mockResolvedValue({
      status: 'approved',
      replayed: false,
      approval,
      item: { ...built.prepared.item, revision: 2 },
    } as never);
    const context = supervisorContext();
    const tools = await toolsFor(context, built);

    await expect(
      execute(tools.factory_resolve_transition_approval as ExecutableTool, context, {
        approvalId: approval.id,
        decision: 'approve',
        reason: 'Scope is ready.',
      }),
    ).resolves.toMatchObject({ status: 'approved', workItemId: built.prepared.item.id, revision: 2 });
    expect(built.approvals.resolve).toHaveBeenCalledWith({
      orgId: ORG_ID,
      factoryProjectId: PROJECT_ID,
      approvalId: approval.id,
      decision: 'approve',
      resolvedBy: 'user-1',
      resolverType: 'agent',
      resolutionReason: 'Scope is ready.',
    });

    built.approvals.get.mockResolvedValue({ ...approval, status: 'stale' } as never);
    await expect(
      execute(tools.factory_resolve_transition_approval as ExecutableTool, context, {
        approvalId: approval.id,
        decision: 'approve',
      }),
    ).rejects.toThrow('already stale');
  });
});
