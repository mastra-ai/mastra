import { describe, expect, it, vi } from 'vitest';

import type { FactoryIdleWithoutTransitionEvent } from '../rules/run-lifecycle-observer.js';
import type { FactorySupervisorNotificationRecord } from '../storage/domains/work-items/base.js';
import type { FactorySupervisorService } from './service.js';
import { FactorySupervisorSignalService } from './signal-service.js';

function fixture() {
  const sendStateSignal = vi.fn().mockResolvedValue({ skipped: false });
  const sendNotificationSignal = vi.fn().mockResolvedValue({
    persisted: Promise.resolve({ id: 'notification-1' }),
    accepted: Promise.resolve({ status: 'accepted' }),
  });
  const session = { sendNotificationSignal };
  const getForProject = vi.fn().mockResolvedValue({
    id: 'item-1',
    title: 'Fix login',
    sessions: { work: { startedBy: 'user-1' } },
  });
  const state = {
    factoryProjectId: 'project-1',
    totalItems: 2,
    counts: { byBoard: { work: 2 }, byStage: { intake: 1, execute: 1 } },
    pendingApprovalCount: 1,
    pendingApprovals: [
      {
        id: 'approval-1',
        workItemId: 'item-1',
        board: 'work',
        stage: 'execute',
        expectedRevision: 2,
        requestingRole: 'work',
        workItemTitle: 'Fix login',
        reason: 'Approval required',
        summary: null,
        createdAt: '2030-01-01T00:00:00.000Z',
        ageSeconds: 10,
      },
    ],
    snapshotAt: '2030-01-01T00:00:10.000Z',
  };
  const service = {
    ensureSession: vi.fn().mockResolvedValue({
      resourceId: 'project-1-supervisor',
      threadId: 'project-1-supervisor',
    }),
    getState: vi.fn().mockImplementation(async () => structuredClone(state)),
    controller: {
      getSessionByResource: vi.fn().mockResolvedValue(session),
      getCurrentAgent: vi.fn().mockReturnValue({ sendStateSignal }),
    },
    workItems: { getForProject },
  };
  return {
    service: service as unknown as FactorySupervisorService,
    state,
    sendStateSignal,
    sendNotificationSignal,
    getForProject,
  };
}

function approvalNotification(): FactorySupervisorNotificationRecord {
  return {
    id: 'event-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    approvalId: 'approval-1',
    workItemId: 'item-1',
    event: 'approval_requested',
    approvalStatus: 'pending',
    requestedStage: 'execute',
    expectedRevision: 2,
    requestingBindingId: 'binding-1',
    requestingRole: 'work',
    supervisorUserId: 'user-1',
    reason: 'Approval required',
    summary: null,
    idempotencyKey: 'approval-1:approval_requested',
    status: 'leased',
    attempts: 1,
    availableAt: new Date(),
    leaseOwner: 'dispatcher',
    leaseExpiresAt: new Date(),
    lastError: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('FactorySupervisorSignalService', () => {
  it('emits a bounded snapshot with a stable cache key', async () => {
    const { service, state, sendStateSignal } = fixture();
    const signals = new FactorySupervisorSignalService(service);

    await signals.refresh({ orgId: 'org-1', userId: 'user-1', factoryProjectId: 'project-1' });
    state.snapshotAt = '2030-01-01T00:00:11.000Z';
    state.pendingApprovals[0]!.ageSeconds = 11;
    await signals.refresh({ orgId: 'org-1', userId: 'user-1', factoryProjectId: 'project-1' });
    state.totalItems = 3;
    await signals.refresh({ orgId: 'org-1', userId: 'user-1', factoryProjectId: 'project-1' });

    expect(sendStateSignal).toHaveBeenCalledTimes(3);
    const [firstSignal, options] = sendStateSignal.mock.calls[0]!;
    const [secondSignal] = sendStateSignal.mock.calls[1]!;
    const [changedSignal] = sendStateSignal.mock.calls[2]!;
    expect(firstSignal).toMatchObject({
      id: 'factory-state',
      mode: 'snapshot',
      tagName: 'factory-state',
      attributes: { factoryProjectId: 'project-1', pendingApprovalCount: 1, totalItems: 2 },
    });
    expect(firstSignal.cacheKey).toBe(secondSignal.cacheKey);
    expect(changedSignal.cacheKey).not.toBe(firstSignal.cacheKey);
    expect(firstSignal.value.pendingApprovals).toHaveLength(1);
    expect(firstSignal.value.pendingApprovals[0]).toMatchObject({ workItemTitle: 'Fix login', ageSeconds: 10 });
    expect(options).toEqual({
      resourceId: 'project-1-supervisor',
      threadId: 'project-1-supervisor',
      ifActive: { behavior: 'deliver' },
      ifIdle: { behavior: 'persist' },
    });
  });

  it('refreshes state and wakes the shared supervisor for approval lifecycle events', async () => {
    const { service, sendStateSignal, sendNotificationSignal, getForProject } = fixture();
    getForProject.mockResolvedValueOnce(null);
    await new FactorySupervisorSignalService(service).notifyApproval(approvalNotification());

    expect(sendStateSignal).toHaveBeenCalledOnce();
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'approval_requested',
        sourceId: 'event-1',
        dedupeKey: 'approval-1:approval_requested',
        payload: expect.objectContaining({ approvalId: 'approval-1', workItemId: 'item-1' }),
      }),
      { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
    );
  });

  it('emits idle-without-transition events only for the captured session owner', async () => {
    const { service, sendStateSignal, sendNotificationSignal } = fixture();
    const event: FactoryIdleWithoutTransitionEvent = {
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItemId: 'item-1',
      bindingId: 'binding-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      sessionId: 'session-1',
      role: 'work',
      stage: 'execute',
      revision: 2,
    };

    await new FactorySupervisorSignalService(service).notifyIdle(event);

    expect(sendStateSignal).toHaveBeenCalledOnce();
    expect(sendNotificationSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'idle-without-transition',
        payload: {
          workItemId: 'item-1',
          bindingId: 'binding-1',
          role: 'work',
          stage: 'execute',
          revision: 2,
        },
      }),
      { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
    );
  });
});
