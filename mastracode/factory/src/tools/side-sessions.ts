import type { NotificationRecord, NotificationsStorage } from '@mastra/core/notifications';

import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_SESSION_NOTIFICATION_SOURCE, resolveSessionThread } from './deliver.js';
import type { FactoryDeliveryController } from './deliver.js';
import { workItemNumber } from './read-tools.js';
import type { FactoryToolScope } from './scope.js';

/** Recent notifications scanned to find each side session's last report. */
export const SIDE_SESSION_NOTIFICATION_SCAN = 100;

export type FactorySessionRunState = 'running' | 'idle' | 'parked';

export interface LastReport {
  kind: string;
  at: string;
}

export interface SideSession {
  sessionId: string;
  title: string;
  state: FactorySessionRunState;
  lastReport: LastReport | null;
  /** When the origin muted this session's reports; null while it reports normally. */
  mutedAt: string | null;
  /** The work item this session is bound to as a worker, if any. */
  workItem: { id: string; label: string; stage: string } | null;
  /** The model the session's thread uses, when known. */
  model: string | null;
  /** Last report time, or the session's last update when it never reported. */
  lastActivityAt: string;
}

export interface SideSessionDependencies {
  sessions: Pick<SourceControlSessionLookup, 'listByOrigin'>;
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingForSession' | 'getForProject'>;
  isRunning: (sessionId: string) => Promise<boolean>;
  notifications: Pick<NotificationsStorage, 'listNotifications'> | null;
  /** Resolves the model a side session uses; omit to leave `model` null. */
  model?: (sessionId: string) => Promise<string | null>;
}

export function lastReport(record: NotificationRecord | undefined): LastReport | null {
  return record ? { kind: record.kind, at: record.createdAt.toISOString() } : null;
}

export function newestNotification(records: NotificationRecord[], match: (record: NotificationRecord) => boolean) {
  let found: NotificationRecord | undefined;
  for (const record of records) {
    if (match(record) && (!found || record.createdAt > found.createdAt)) found = record;
  }
  return found;
}

export function itemLabel(item: WorkItemRow): string {
  const number = workItemNumber(item);
  return number === null ? item.id : `#${number}`;
}

export async function listSessionNotifications(
  notifications: Pick<NotificationsStorage, 'listNotifications'> | null,
  threadId: string,
): Promise<NotificationRecord[]> {
  return notifications
    ? notifications.listNotifications({
        threadId,
        source: FACTORY_SESSION_NOTIFICATION_SOURCE,
        limit: SIDE_SESSION_NOTIFICATION_SCAN,
      })
    : [];
}

/**
 * Every side session the scope's session started in its Factory project,
 * newest activity first. Callers apply their own age and row caps.
 */
export async function listSideSessions(
  deps: SideSessionDependencies,
  scope: Pick<FactoryToolScope, 'orgId' | 'factoryProjectId' | 'sessionId' | 'threadId'>,
  options: { records?: NotificationRecord[] } = {},
): Promise<SideSession[]> {
  const records = options.records ?? (await listSessionNotifications(deps.notifications, scope.threadId));
  const rows = await deps.sessions.listByOrigin({ orgId: scope.orgId, originSessionId: scope.sessionId });
  const sideSessions: SideSession[] = [];
  for (const row of rows) {
    if (row.factoryProjectId !== scope.factoryProjectId) continue;
    const last = newestNotification(records, record => record.attributes?.['from-session'] === row.sessionId);
    const running = await deps.isRunning(row.sessionId);
    const state: FactorySessionRunState = running ? 'running' : last?.kind === 'blocked' ? 'parked' : 'idle';
    const binding = await deps.workItems.findActiveRunBindingForSession({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      sessionId: row.sessionId,
    });
    const item = binding
      ? await deps.workItems.getForProject(scope.orgId, scope.factoryProjectId, binding.workItemId)
      : null;
    sideSessions.push({
      sessionId: row.sessionId,
      title: row.title ?? row.sessionId,
      state,
      lastReport: lastReport(last),
      mutedAt: row.originMutedAt?.toISOString() ?? null,
      workItem: item ? { id: item.id, label: itemLabel(item), stage: item.stages[0] ?? 'unknown' } : null,
      model: deps.model ? await deps.model(row.sessionId) : null,
      lastActivityAt: (last?.createdAt ?? row.updatedAt).toISOString(),
    });
  }
  return sideSessions.sort((left, right) => right.lastActivityAt.localeCompare(left.lastActivityAt));
}

/** The model a session's thread uses: the live session's selection, else the persisted one. */
export async function sessionModel(
  controller: Pick<FactoryDeliveryController, 'getSessionByResource' | 'queryThreads' | 'queryThreadById'>,
  sessions: Parameters<typeof resolveSessionThread>[0]['sessions'],
  workItems: Parameters<typeof resolveSessionThread>[0]['workItems'],
  sessionId: string,
): Promise<string | null> {
  const live = await controller.getSessionByResource(sessionId);
  const liveModel = live?.model.get();
  if (liveModel) return liveModel;
  const threadId = await resolveSessionThread({ controller, sessions, workItems, sessionId });
  if (!threadId) return null;
  const thread = await controller.queryThreadById({ threadId });
  const persisted = thread?.metadata?.currentModelId;
  return typeof persisted === 'string' && persisted ? persisted : null;
}
