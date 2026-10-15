import { createHash } from 'node:crypto';
import type { NotificationRecord, NotificationsStorage } from '@mastra/core/notifications';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_SESSION_NOTIFICATION_SOURCE } from './deliver.js';
import { workItemNumber } from './read-tools.js';
import { resolveFactoryToolScope } from './scope.js';
import type { FactoryToolScope, ResolveFactoryToolScopeOptions } from './scope.js';

const STATE_ID = 'factory-sessions';
/** Finished side sessions and items that reached a terminal stage drop out after this long. */
export const FACTORY_SESSIONS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Rows shown before the rest collapse into "+N more". */
export const FACTORY_SESSIONS_MAX_ROWS = 20;
const NOTIFICATION_SCAN = 100;
const EMPTY_CACHE_KEY = 'empty';

export type FactorySessionRunState = 'running' | 'idle' | 'parked';

export interface FactorySessionsStateDependencies {
  authEnabled: boolean;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId' | 'listByOrigin'>;
  projects: ResolveFactoryToolScopeOptions['projects'];
  workItems: Pick<
    WorkItemsStorage,
    | 'hasRunBindingForSession'
    | 'listSessionSubscriptions'
    | 'getForProject'
    | 'listRunBindings'
    | 'findActiveRunBindingForSession'
    | 'listWorkItemSubscribers'
  >;
  boards: BoardRegistry;
  /** Whether the session's agent is mid-run in this process; `idle` when it isn't live here. */
  isRunning: (sessionId: string) => Promise<boolean>;
  notifications: () => Promise<Pick<NotificationsStorage, 'listNotifications'> | null>;
  now?: () => number;
}

interface LastReport {
  kind: string;
  at: string;
}

interface SideSessionRow {
  sessionId: string;
  title: string;
  state: FactorySessionRunState;
  lastReport: LastReport | null;
}

interface FollowedRow {
  workItemId: string;
  label: string;
  title: string;
  stage: string;
  worker: { role: string; sessionId: string; state: FactorySessionRunState } | null;
  lastReport: LastReport | null;
}

interface SessionsState {
  sideSessions: SideSessionRow[];
  following: FollowedRow[];
  more: number;
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function cacheKeyFor(value: unknown): string {
  return `sessions:${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)}`;
}

function report(record: NotificationRecord | undefined): LastReport | null {
  return record ? { kind: record.kind, at: record.createdAt.toISOString() } : null;
}

function newest(records: NotificationRecord[], match: (record: NotificationRecord) => boolean) {
  let found: NotificationRecord | undefined;
  for (const record of records) {
    if (match(record) && (!found || record.createdAt > found.createdAt)) found = record;
  }
  return found;
}

function itemLabel(item: WorkItemRow): string {
  const number = workItemNumber(item);
  return number === null ? item.id : `#${number}`;
}

/**
 * The `<factory-sessions>` state signal. A user session sees the side sessions
 * it started and the work items it follows; a side session or item worker sees
 * who it reports to. Sessions it only messaged never appear. Silent until there
 * is something to show; when the last entry ages out it sends one final empty
 * snapshot, then stays silent.
 */
export class FactorySessionsStateProcessor implements Processor<'factory-sessions'> {
  readonly id = STATE_ID;
  readonly stateId = STATE_ID;
  readonly #deps: FactorySessionsStateDependencies;

  constructor(deps: FactorySessionsStateDependencies) {
    this.#deps = deps;
  }

  async computeStateSignal(args: ComputeStateSignalArgs): Promise<ComputeStateSignalResult> {
    const scope = await resolveFactoryToolScope({
      requestContext: args.requestContext!,
      authEnabled: this.#deps.authEnabled,
      sessions: this.#deps.sessions,
      projects: this.#deps.projects,
      workItems: this.#deps.workItems,
    });
    if (!scope) return;

    const hasBase = Boolean(args.lastSnapshot) && args.contextWindow.hasSnapshot;
    const previousKey = hasBase
      ? (args.tracking?.currentCacheKey ?? (args.lastSnapshot?.metadata?.state as { cacheKey?: string })?.cacheKey)
      : undefined;
    const unchanged = (cacheKey: string) => previousKey === cacheKey;
    // Silence rule: one final empty snapshot replaces a non-empty one, then nothing.
    const cleared = () => hasBase && previousKey !== undefined && previousKey !== EMPTY_CACHE_KEY;

    if (scope.kind === 'worker') {
      const contents = await this.#workerLine(scope);
      if (!contents) {
        return cleared()
          ? this.#signal(EMPTY_CACHE_KEY, 'Nobody follows this work now.', {}, { entries: 0 })
          : undefined;
      }
      const cacheKey = cacheKeyFor(contents);
      if (unchanged(cacheKey)) return;
      return this.#signal(cacheKey, escapeText(contents), { worker: contents }, { entries: 1 });
    }

    const state = await this.#userState(scope);
    if (state.sideSessions.length === 0 && state.following.length === 0) {
      if (!cleared()) return;
      return this.#signal(EMPTY_CACHE_KEY, 'No sub-sessions or followed work items.', state, { entries: 0 });
    }
    const cacheKey = cacheKeyFor(state);
    if (unchanged(cacheKey)) return;
    return this.#signal(cacheKey, this.#render(state), state, {
      sideSessions: state.sideSessions.length,
      following: state.following.length,
    });
  }

  #signal(cacheKey: string, contents: string, value: unknown, attributes: Record<string, number>) {
    return {
      id: STATE_ID,
      cacheKey,
      mode: 'snapshot' as const,
      tagName: 'factory-sessions',
      contents,
      value: { sessions: value },
      attributes,
      metadata: { value: { sessions: value } },
    };
  }

  async #workerLine(scope: FactoryToolScope): Promise<string | null> {
    if (scope.origin) {
      return `Started by session ${scope.origin.sessionId} (thread ${scope.origin.threadId}). Report back with factory_message_origin.`;
    }
    const binding = await this.#deps.workItems.findActiveRunBindingForSession({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      sessionId: scope.sessionId,
    });
    if (!binding) return null;
    const item = await this.#deps.workItems.getForProject(scope.orgId, scope.factoryProjectId, binding.workItemId);
    const subscribers = await this.#deps.workItems.listWorkItemSubscribers({
      orgId: scope.orgId,
      workItemId: binding.workItemId,
    });
    const following = subscribers.filter(subscriber => subscriber.sessionId !== scope.sessionId).length;
    // Nobody to report to: nothing worth showing (most board-started workers).
    if (following === 0) return null;
    const label = item ? itemLabel(item) : binding.workItemId;
    return `Working on ${label} as ${binding.role}. Reports go to ${following} following session${following === 1 ? '' : 's'}.`;
  }

  async #userState(scope: FactoryToolScope): Promise<SessionsState> {
    const now = this.#deps.now?.() ?? Date.now();
    const notifications = await this.#deps.notifications();
    const records = notifications
      ? await notifications.listNotifications({
          threadId: scope.threadId,
          source: FACTORY_SESSION_NOTIFICATION_SOURCE,
          limit: NOTIFICATION_SCAN,
        })
      : [];

    const sideRows = await this.#deps.sessions.listByOrigin({ orgId: scope.orgId, originSessionId: scope.sessionId });
    const sideSessions: Array<SideSessionRow & { active: boolean }> = [];
    for (const row of sideRows) {
      if (row.factoryProjectId !== scope.factoryProjectId) continue;
      const last = newest(records, record => record.attributes?.['from-session'] === row.sessionId);
      const running = await this.#deps.isRunning(row.sessionId);
      const lastActivity = last?.createdAt.getTime() ?? row.updatedAt.getTime();
      if (!running && now - lastActivity > FACTORY_SESSIONS_MAX_AGE_MS) continue;
      const state: FactorySessionRunState = running ? 'running' : last?.kind === 'blocked' ? 'parked' : 'idle';
      sideSessions.push({
        sessionId: row.sessionId,
        title: row.title ?? row.sessionId,
        state,
        lastReport: report(last),
        active: state !== 'idle',
      });
    }

    const subscriptions = await this.#deps.workItems.listSessionSubscriptions({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      sessionId: scope.sessionId,
    });
    const following: Array<FollowedRow & { active: boolean }> = [];
    for (const subscription of subscriptions) {
      const item = await this.#deps.workItems.getForProject(
        scope.orgId,
        scope.factoryProjectId,
        subscription.workItemId,
      );
      if (!item) continue;
      const stage = item.stages[0] ?? 'unknown';
      const terminal = this.#deps.boards.get(boardForWorkItem(item))?.isTerminal(stage) ?? false;
      if (terminal && now - item.updatedAt.getTime() > FACTORY_SESSIONS_MAX_AGE_MS) continue;
      const bindings = await this.#deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, item.id);
      const active = bindings.find(binding => binding.status === 'active');
      const label = itemLabel(item);
      const last = newest(
        records,
        record =>
          record.attributes?.['work-item'] === label || (record.kind === 'stage' && record.sourceId === item.id),
      );
      const running = active ? await this.#deps.isRunning(active.sessionId) : false;
      const lastFromWorker = active
        ? newest(records, record => record.attributes?.['from-session'] === active.sessionId)
        : undefined;
      following.push({
        workItemId: item.id,
        label,
        title: item.title,
        stage,
        worker: active
          ? {
              role: active.role,
              sessionId: active.sessionId,
              state: running ? 'running' : lastFromWorker?.kind === 'blocked' ? 'parked' : 'idle',
            }
          : null,
        lastReport: report(last),
        active: running && !terminal,
      });
    }

    // Active entries first, then within the cap; the rest collapse into "+N more".
    const ordered = [
      ...sideSessions.map(row => ({ section: 'side' as const, row })),
      ...following.map(row => ({ section: 'following' as const, row })),
    ].sort((a, b) => Number(b.row.active) - Number(a.row.active));
    const shown = ordered.slice(0, FACTORY_SESSIONS_MAX_ROWS);
    const strip = <T extends { active: boolean }>({ active: _active, ...row }: T) => row;
    return {
      sideSessions: shown.flatMap(entry =>
        entry.section === 'side' ? [strip(entry.row as SideSessionRow & { active: boolean })] : [],
      ),
      following: shown.flatMap(entry =>
        entry.section === 'following' ? [strip(entry.row as FollowedRow & { active: boolean })] : [],
      ),
      more: ordered.length - shown.length,
    };
  }

  #render(state: SessionsState): string {
    const lastReport = (last: LastReport | null) => (last ? `; last report ${last.kind} at ${last.at}` : '');
    const lines: string[] = [];
    if (state.sideSessions.length > 0) {
      lines.push('Side sessions you started:');
      for (const row of state.sideSessions) {
        lines.push(
          `- "${escapeText(row.title)}" (session ${row.sessionId}): ${row.state}${lastReport(row.lastReport)}`,
        );
      }
    }
    if (state.following.length > 0) {
      lines.push('Work items you follow:');
      for (const row of state.following) {
        const worker = row.worker
          ? `; ${escapeText(row.worker.role)} session ${row.worker.sessionId} ${row.worker.state}`
          : '';
        lines.push(
          `- ${escapeText(row.label)} "${escapeText(row.title)}": ${escapeText(row.stage)}${worker}${lastReport(row.lastReport)}`,
        );
      }
    }
    if (state.more > 0) lines.push(`+${state.more} more`);
    lines.push('Message any of these sessions with factory_signal_session; read full reports with notification_inbox.');
    return lines.join('\n');
  }
}
