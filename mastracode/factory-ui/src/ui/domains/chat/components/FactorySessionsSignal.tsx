import { ActivityItem } from '@mastra/playground-ui/components/ai/activity';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Layers } from 'lucide-react';
import { useParams } from 'react-router';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { itemThreadSession } from '../../factory/boardItems';
import { RelatedWorkItemLink } from '../../factory/components/RelatedWorkItemLink';
import { relationshipPath } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { SessionListItem } from '../../workspaces/components/SessionListItem';
import { SessionNavRow } from '../../workspaces/components/SessionNavRow';
import { setSessionPinned } from '../../workspaces/hooks/usePinnedSessions';
import { useSessionListRows } from '../../workspaces/hooks/useSessionListRows';
import type { SessionListRow } from '../../workspaces/services/sessionRows';
import type { SessionRowStatus } from '../../workspaces/services/sessionStatus';
import type { MessageEntry } from '../services/transcript';
import { isRecord } from './transcript-shared';

export const FACTORY_SESSIONS_STATE_ID = 'factory-sessions';

type RunState = 'running' | 'parked' | 'idle';

interface LastReportView {
  kind: string;
  at: string;
}

interface SideSessionView {
  sessionId: string;
  title: string;
  state: RunState;
  muted: boolean;
  lastReport: LastReportView | null;
}

interface FollowedItemView {
  workItemId: string;
  label: string;
  title: string;
  stage: string;
  worker: { role: string; sessionId: string; state: RunState; quiet: boolean } | null;
  lastReport: LastReportView | null;
}

export interface FactorySessionsView {
  sideSessions: SideSessionView[];
  following: FollowedItemView[];
  more: number;
}

function runState(value: unknown): RunState | undefined {
  return value === 'running' || value === 'parked' || value === 'idle' ? value : undefined;
}

function lastReport(value: unknown): LastReportView | null {
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.at !== 'string') return null;
  return { kind: value.kind, at: value.at };
}

function sideSession(value: unknown): SideSessionView | undefined {
  if (!isRecord(value) || typeof value.sessionId !== 'string') return undefined;
  const state = runState(value.state);
  if (!state) return undefined;
  return {
    sessionId: value.sessionId,
    title: typeof value.title === 'string' && value.title ? value.title : value.sessionId,
    state,
    muted: value.muted === true,
    lastReport: lastReport(value.lastReport),
  };
}

function followedItem(value: unknown): FollowedItemView | undefined {
  if (!isRecord(value) || typeof value.workItemId !== 'string') return undefined;
  const worker = isRecord(value.worker) ? value.worker : undefined;
  const workerState = runState(worker?.state);
  return {
    workItemId: value.workItemId,
    label: typeof value.label === 'string' ? value.label : '',
    title: typeof value.title === 'string' ? value.title : '',
    stage: typeof value.stage === 'string' ? value.stage : '',
    worker:
      worker && typeof worker.sessionId === 'string' && workerState
        ? {
            role: typeof worker.role === 'string' && worker.role ? worker.role : 'worker',
            sessionId: worker.sessionId,
            state: workerState,
            quiet: typeof worker.quietSince === 'string',
          }
        : null,
    lastReport: lastReport(value.lastReport),
  };
}

/**
 * The structured rows the `factory-sessions` state signal persists beside its text
 * (`metadata.value.sessions`). Undefined for worker-only or unreadable snapshots,
 * which keep the plain text row.
 */
export function factorySessionsView(entry: MessageEntry): FactorySessionsView | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || !isRecord(signal.metadata) || !isRecord(signal.metadata.value)) return undefined;
  const sessions = signal.metadata.value.sessions;
  if (!isRecord(sessions) || !Array.isArray(sessions.sideSessions) || !Array.isArray(sessions.following)) {
    return undefined;
  }
  const view = {
    sideSessions: sessions.sideSessions.flatMap(row => sideSession(row) ?? []),
    following: sessions.following.flatMap(row => followedItem(row) ?? []),
    more: typeof sessions.more === 'number' && sessions.more > 0 ? sessions.more : 0,
  };
  return view.sideSessions.length + view.following.length > 0 ? view : undefined;
}

const STATUS_BY_RUN_STATE: Record<RunState, SessionRowStatus | undefined> = {
  running: 'working',
  parked: 'ready',
  idle: undefined,
};

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function summary(view: FactorySessionsView) {
  const parts = [];
  if (view.sideSessions.length > 0) parts.push(plural(view.sideSessions.length, 'side session'));
  if (view.following.length > 0) parts.push(plural(view.following.length, 'followed work item'));
  if (view.more > 0) parts.push(`+${view.more} more`);
  return parts.join(' · ');
}

function workerLabel(worker: FollowedItemView['worker']) {
  if (!worker) return 'no worker';
  if (worker.state === 'running') return `${worker.role} ${worker.quiet ? 'quiet' : 'running'}`;
  return `${worker.role} ${worker.state === 'parked' ? 'waiting' : 'idle'}`;
}

function reportLabel(report: LastReportView | null) {
  if (!report) return undefined;
  const when = relativeTime(report.at);
  return `last report ${report.kind}${when ? ` ${when}` : ''}`;
}

function workItemHref(item: WorkItem, factoryId: string): { href: string; kind: 'session' | 'external' | 'board' } {
  const session = itemThreadSession(item.sessions);
  if (session) {
    return {
      href: `/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.threadId}`,
      kind: 'session',
    };
  }
  if (item.url !== null) return { href: item.url, kind: 'external' };
  return { href: relationshipPath(item, factoryId), kind: 'board' };
}

/** The `factory-sessions` snapshot as sidebar session rows and work item links instead of its text. */
export function FactorySessionsSignal({ view, mode }: { view: FactorySessionsView; mode: string }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const { rows } = useSessionListRows(factoryId);
  const workItems = useWorkItemsQuery(factoryId);
  const rowById = new Map(rows.map(row => [row.session.sessionId, row]));
  const itemById = new Map((workItems.data ?? []).map(item => [item.id, item]));

  const sessionRow = (session: SideSessionView, row: SessionListRow | undefined) => {
    // The live row knows the session's current status, owner and links; the snapshot is a moment ago.
    if (row) {
      return (
        <SessionListItem
          key={session.sessionId}
          factoryId={factoryId}
          row={row}
          disabled={false}
          merged={row.pullRequest?.knownMerged}
          state="default"
        />
      );
    }
    return (
      <SessionNavRow
        key={session.sessionId}
        name={session.title}
        url={`/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.sessionId}`}
        externalLinks={[]}
        active={false}
        disabled={false}
        status={STATUS_BY_RUN_STATE[session.state]}
        onPinChange={pinned => setSessionPinned(session.sessionId, pinned)}
        state="default"
      />
    );
  };

  return (
    <ActivityItem
      icon={<Layers className="text-badge-purple-indicator" aria-hidden />}
      label={FACTORY_SESSIONS_STATE_ID}
      detail={summary(view)}
      badges={<Badge size="xs">{mode}</Badge>}
      defaultOpen
      data-signal-kind="state"
      aria-label={`Signal: ${FACTORY_SESSIONS_STATE_ID}`}
    >
      <div className="flex flex-col gap-2">
        {view.sideSessions.length > 0 && (
          <section aria-label="Side sessions" className="flex flex-col gap-1">
            <Txt variant="meta" tone="muted">
              Side sessions
            </Txt>
            <div className="flex max-w-90 flex-col">
              {view.sideSessions.map(session => {
                const row = rowById.get(session.sessionId);
                const facts = [session.muted ? 'muted' : undefined, reportLabel(session.lastReport)].filter(Boolean);
                return (
                  <div key={session.sessionId} className="flex flex-col">
                    <ul className="flex flex-col">{sessionRow(session, row)}</ul>
                    {facts.length > 0 && (
                      <Txt variant="meta" tone="muted" className="ps-8">
                        {facts.join(' · ')}
                      </Txt>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {view.following.length > 0 && (
          <section aria-label="Followed work items" className="flex flex-col gap-1">
            <Txt variant="meta" tone="muted">
              Work items you follow
            </Txt>
            <ul className="flex flex-col gap-1">
              {view.following.map(followed => {
                const item = itemById.get(followed.workItemId);
                const status = [followed.stage, workerLabel(followed.worker), reportLabel(followed.lastReport)]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={followed.workItemId} className="flex min-w-0 items-center gap-2">
                    {item ? (
                      <RelatedWorkItemLink item={item} {...workItemHref(item, factoryId)} />
                    ) : (
                      <Txt as="span" variant="meta" className="min-w-0 truncate">
                        {[followed.label, followed.title].filter(Boolean).join(' ')}
                      </Txt>
                    )}
                    <Txt as="span" variant="meta" tone="muted" className="shrink-0">
                      {status}
                    </Txt>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {view.more > 0 && (
          <Txt variant="meta" tone="muted">
            +{view.more} more
          </Txt>
        )}
      </div>
    </ActivityItem>
  );
}
