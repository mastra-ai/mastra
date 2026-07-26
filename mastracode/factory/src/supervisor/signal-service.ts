import { createHash } from 'node:crypto';

import type { FactoryIdleWithoutTransitionEvent } from '../rules/run-lifecycle-observer.js';
import type {
  FactorySupervisorNotificationEvent,
  FactorySupervisorNotificationRecord,
} from '../storage/domains/work-items/base.js';
import type { FactorySupervisorService } from './service.js';

const STATE_SIGNAL_ID = 'factory-state';

function cacheKey(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

type FactoryApprovalNotificationRecord = Omit<FactorySupervisorNotificationRecord, 'event'> & {
  event: Exclude<FactorySupervisorNotificationEvent, 'boot_check_in'>;
  approvalId: string;
  workItemId: string;
  requestedStage: string;
};

function isApprovalNotification(
  record: FactorySupervisorNotificationRecord,
): record is FactoryApprovalNotificationRecord {
  return record.event !== 'boot_check_in';
}

function approvalSummary(record: FactoryApprovalNotificationRecord): string {
  switch (record.event) {
    case 'approval_requested':
      return `Transition approval requested for ${record.requestedStage}.`;
    case 'approval_approved':
      return `Transition to ${record.requestedStage} was approved.`;
    case 'approval_rejected':
      return `Transition to ${record.requestedStage} was rejected.`;
    case 'approval_stale':
      return `Transition approval for ${record.requestedStage} became stale.`;
  }
}

export class FactorySupervisorSignalService {
  readonly #supervisor: FactorySupervisorService;

  constructor(supervisor: FactorySupervisorService) {
    this.#supervisor = supervisor;
  }

  async refresh(input: { orgId: string; userId: string; factoryProjectId: string }) {
    const address = await this.#supervisor.ensureSession(input);
    const state = await this.#supervisor.getState(input);
    const stableState = {
      factoryProjectId: state.factoryProjectId,
      totalItems: state.totalItems,
      counts: state.counts,
      pendingApprovalCount: state.pendingApprovalCount,
      pendingApprovals: state.pendingApprovals.map(({ ageSeconds: _ageSeconds, ...approval }) => approval),
      workers: state.workers,
    };
    const stateCacheKey = cacheKey(stableState);
    const snapshot = { ...state, snapshotVersion: stateCacheKey };
    const session = await this.#supervisor.controller.getSessionByResource(address.resourceId);
    if (!session) throw new Error('Factory supervisor session is unavailable.');
    const agent = this.#supervisor.controller.getCurrentAgent(session);
    return agent.sendStateSignal(
      {
        id: STATE_SIGNAL_ID,
        cacheKey: stateCacheKey,
        mode: 'snapshot',
        tagName: 'factory-state',
        contents: `Factory state snapshot:\n${JSON.stringify(snapshot)}`,
        value: snapshot,
        attributes: {
          factoryProjectId: input.factoryProjectId,
          pendingApprovalCount: state.pendingApprovalCount,
          totalItems: state.totalItems,
        },
        metadata: { source: 'factory-supervisor', snapshotVersion: stateCacheKey },
      },
      {
        resourceId: address.resourceId,
        threadId: address.threadId,
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
      },
    );
  }

  /** Deliver one durable supervisor notification, whatever kind it is. */
  async notify(record: FactorySupervisorNotificationRecord): Promise<void> {
    return isApprovalNotification(record) ? this.notifyApproval(record) : this.notifyBootCheckIn(record);
  }

  async notifyApproval(record: FactoryApprovalNotificationRecord): Promise<void> {
    const item = await this.#supervisor.workItems.getForProject(
      record.orgId,
      record.factoryProjectId,
      record.workItemId,
    );
    const userId =
      record.supervisorUserId ??
      (record.requestingRole ? item?.sessions[record.requestingRole]?.startedBy : undefined) ??
      Object.values(item?.sessions ?? {}).find(session => session.startedBy)?.startedBy;
    if (!userId) throw new Error('Factory approval has no authenticated session owner.');

    await this.#deliver(record, userId, {
      kind: record.event,
      summary: approvalSummary(record),
      priority: record.event === 'approval_requested' ? 'high' : 'medium',
      payload: {
        approvalId: record.approvalId,
        workItemId: record.workItemId,
        status: record.approvalStatus,
        requestedStage: record.requestedStage,
        expectedRevision: record.expectedRevision,
        reason: record.reason,
        summary: record.summary,
      },
    });
  }

  /**
   * Wake the supervisor after a restart. Runs killed mid-flight never emit an
   * `agent_end`, so the idle observer cannot see them — this is the only
   * signal that surfaces work stranded by the restart itself.
   */
  async notifyBootCheckIn(record: FactorySupervisorNotificationRecord): Promise<void> {
    if (!record.supervisorUserId) throw new Error('Factory boot check-in has no authenticated session owner.');
    await this.#deliver(record, record.supervisorUserId, {
      kind: 'boot-check-in',
      summary: record.summary ?? 'The Factory server restarted.',
      priority: 'medium',
      payload: { reason: record.reason, summary: record.summary },
    });
  }

  async #deliver(
    record: FactorySupervisorNotificationRecord,
    userId: string,
    notification: { kind: string; summary: string; priority: 'medium' | 'high'; payload: Record<string, unknown> },
  ): Promise<void> {
    const address = await this.#supervisor.ensureSession({
      orgId: record.orgId,
      userId,
      factoryProjectId: record.factoryProjectId,
    });
    await this.refresh({ orgId: record.orgId, userId, factoryProjectId: record.factoryProjectId });
    const session = await this.#supervisor.controller.getSessionByResource(address.resourceId);
    if (!session) throw new Error('Factory supervisor session is unavailable.');
    const result = await session.sendNotificationSignal(
      { source: 'factory', ...notification, sourceId: record.id, dedupeKey: record.idempotencyKey },
      { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
    );
    await result.persisted;
    if (!result.accepted) throw new Error('Factory supervisor notification was not accepted for delivery.');
    await result.accepted;
  }

  async notifyIdle(event: FactoryIdleWithoutTransitionEvent): Promise<void> {
    const item = await this.#supervisor.workItems.getForProject(event.orgId, event.factoryProjectId, event.workItemId);
    const userId = item?.sessions[event.role]?.startedBy;
    if (!item || !userId) return;
    const address = await this.#supervisor.ensureSession({
      orgId: event.orgId,
      userId,
      factoryProjectId: event.factoryProjectId,
    });
    await this.refresh({ orgId: event.orgId, userId, factoryProjectId: event.factoryProjectId });
    const session = await this.#supervisor.controller.getSessionByResource(address.resourceId);
    if (!session) throw new Error('Factory supervisor session is unavailable.');
    const result = await session.sendNotificationSignal(
      {
        source: 'factory',
        kind: 'idle-without-transition',
        summary: `Work-item agent finished without moving ${item.title}.`,
        priority: 'medium',
        payload: {
          workItemId: event.workItemId,
          bindingId: event.bindingId,
          role: event.role,
          stage: event.stage,
          revision: event.revision,
        },
      },
      { ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'wake' } },
    );
    await result.persisted;
    await result.accepted;
  }
}
