import { createHash } from 'node:crypto';
import type { NotificationsStorage } from '@mastra/core/notifications';
import type { ComputeStateSignalArgs, ComputeStateSignalResult, Processor } from '@mastra/core/processors';

import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { resolveFactoryToolScope } from './scope.js';
import type { FactoryToolScope, ResolveFactoryToolScopeOptions } from './scope.js';
import {
  itemLabel,
  lastReport as report,
  listSessionNotifications,
  listSideSessions,
  newestNotification as newest,
} from './side-sessions.js';
import type { FactorySessionRunState, LastReport } from './side-sessions.js';

const STATE_ID = 'factory-sessions';
/** Finished side sessions and items that reached a terminal stage drop out after this long. */
export const FACTORY_SESSIONS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Asks a long run to show it is still moving; a silent half hour reads the same as a stuck one. */
const PROGRESS_ASK = 'On long work, send a progress report after each plan step.';

/** A running worker whose thread has not moved for this long is shown as quiet, so a stuck run stands out. */
export const FACTORY_SESSIONS_QUIET_MS = 10 * 60 * 1000;
/** Rows shown before the rest collapse into "+N more". */
export const FACTORY_SESSIONS_MAX_ROWS = 20;
const EMPTY_CACHE_KEY = 'empty';

export type { FactorySessionRunState } from './side-sessions.js';

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
  /** When a thread last changed; tells a long run that is still moving from one that stopped. */
  lastActivity?: (threadId: string) => Promise<Date | null>;
  notifications: () => Promise<Pick<NotificationsStorage, 'listNotifications'> | null>;
  now?: () => number;
}

interface SideSessionRow {
  sessionId: string;
  title: string;
  state: FactorySessionRunState;
  lastReport: LastReport | null;
  muted: boolean;
}

interface FollowedRow {
  workItemId: string;
  label: string;
  title: string;
  stage: string;
  worker: { role: string; sessionId: string; state: FactorySessionRunState; quietSince: string | null } | null;
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
          ? this.#signal(EMPTY_CACHE_KEY, 'This session is not reporting on any work now.', {}, { entries: 0 })
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
      return `Started by session ${scope.origin.sessionId} (thread ${scope.origin.threadId}). Report back with factory_message_origin. ${PROGRESS_ASK}`;
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
    return `Working on ${label} as ${binding.role}. Reports go to ${following} following session${following === 1 ? '' : 's'}. ${PROGRESS_ASK}`;
  }

  async #userState(scope: FactoryToolScope): Promise<SessionsState> {
    const now = this.#deps.now?.() ?? Date.now();
    const notifications = await this.#deps.notifications();
    const records = await listSessionNotifications(notifications, scope.threadId);

    const sideSessions: Array<SideSessionRow & { active: boolean }> = [];
    const listed = await listSideSessions(
      {
        sessions: this.#deps.sessions,
        workItems: this.#deps.workItems,
        isRunning: this.#deps.isRunning,
        notifications,
      },
      scope,
      { records },
    );
    for (const row of listed) {
      if (row.state !== 'running' && now - Date.parse(row.lastActivityAt) > FACTORY_SESSIONS_MAX_AGE_MS) continue;
      sideSessions.push({
        sessionId: row.sessionId,
        title: row.title,
        state: row.state,
        lastReport: row.lastReport,
        muted: row.mutedAt !== null,
        active: row.state !== 'idle',
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
      const lastActivity = active && running ? await this.#deps.lastActivity?.(active.threadId) : null;
      // Only a quiet run is shown with its time; a moving one would change the snapshot on every step.
      const quiet = lastActivity && now - lastActivity.getTime() >= FACTORY_SESSIONS_QUIET_MS ? lastActivity : null;
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
              quietSince: quiet ? quiet.toISOString() : null,
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
          `- "${escapeText(row.title)}" (session ${row.sessionId}): ${row.state}${row.muted ? ' (muted)' : ''}${lastReport(row.lastReport)}`,
        );
      }
    }
    if (state.following.length > 0) {
      lines.push('Work items you follow:');
      for (const row of state.following) {
        const worker = row.worker
          ? `; ${escapeText(row.worker.role)} session ${row.worker.sessionId} ${row.worker.state}${row.worker.quietSince ? ` but quiet since ${row.worker.quietSince}` : ''}`
          : '';
        lines.push(
          `- ${escapeText(row.label)} "${escapeText(row.title)}": ${escapeText(row.stage)}${worker}${lastReport(row.lastReport)}`,
        );
      }
    }
    if (state.more > 0) lines.push(`+${state.more} more`);
    lines.push(
      'Message any of these sessions with factory_signal_session; read full reports with notification_inbox; list side sessions with factory_list_side_sessions; on a turn a person started, mute one with factory_unsubscribe_session.',
    );
    return lines.join('\n');
  }
}
