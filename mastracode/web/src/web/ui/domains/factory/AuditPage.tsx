import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { useAuditEvents, useAuditPortalLink } from '../../../../shared/hooks/useAuditEvents';
import { relativeTime } from '../../../../shared/lib/date';
import { FactoryPageShell } from './components/FactoryPageShell';
import type { AuditEvent } from './services/audit';

/** Action-group filters mapped to the concrete v1 action taxonomy. */
const ACTION_GROUPS = [
  { key: 'all', label: 'All', actions: undefined },
  {
    key: 'work-items',
    label: 'Work items',
    actions: [
      'factory.work_item.created',
      'factory.work_item.updated',
      'factory.work_item.stage_moved',
      'factory.work_item.deleted',
    ],
  },
  { key: 'runs', label: 'Runs', actions: ['factory.run.started', 'factory.triage.started'] },
  { key: 'worktrees', label: 'Worktrees', actions: ['factory.worktree.created', 'factory.worktree.deleted'] },
  { key: 'git', label: 'Git', actions: ['factory.git.commit', 'factory.git.push', 'factory.git.pr_opened'] },
  {
    key: 'agent',
    label: 'Agent',
    actions: ['factory.agent.commit', 'factory.agent.push', 'factory.agent.pr_opened'],
  },
  { key: 'intake', label: 'Intake', actions: ['factory.intake.config_updated'] },
] as const;

type GroupKey = (typeof ACTION_GROUPS)[number]['key'];

/** Short human label for a dot-namespaced action, e.g. 'Stage moved'. */
function actionLabel(action: string): string {
  const leaf = action.split('.').pop() ?? action;
  const words = leaf.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The Factory audit trail: an append-only, org-scoped record of who did what,
 * when — every work-item mutation, stage move, run start, worktree change, and
 * git action. Backed by the local `audit_events` table; the "Open in WorkOS"
 * button (shown when WorkOS is configured) opens the enterprise viewer.
 */
export function AuditPage() {
  return (
    <FactoryPageShell
      title="Audit"
      description="Who did what, when — every board change, run start, worktree change, and git action."
    >
      {project => <AuditContent factoryProjectId={project.binding.factoryProjectId} />}
    </FactoryPageShell>
  );
}

function AuditContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [group, setGroup] = useState<GroupKey>('all');
  const actions = ACTION_GROUPS.find(entry => entry.key === group)?.actions;
  const eventsQuery = useAuditEvents(factoryProjectId, group, actions ? [...actions] : undefined);
  const portalQuery = useAuditPortalLink(true);

  if (eventsQuery.isError) {
    return <Notice variant="destructive">{(eventsQuery.error as Error).message}</Notice>;
  }
  const events = eventsQuery.data?.pages.flatMap(page => page.events) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ButtonsGroup spacing="close" role="group" aria-label="Audit filter">
          {ACTION_GROUPS.map(entry => (
            <Button
              key={entry.key}
              variant={group === entry.key ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={group === entry.key}
              onClick={() => setGroup(entry.key)}
            >
              {entry.label}
            </Button>
          ))}
        </ButtonsGroup>
        {portalQuery.data ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Portal links are one-time use: open, then fetch a fresh one.
              window.open(portalQuery.data!, '_blank', 'noopener,noreferrer');
              void portalQuery.refetch();
            }}
          >
            Open in WorkOS
          </Button>
        ) : null}
      </div>

      {!eventsQuery.data ? null : events.length === 0 ? (
        <EmptyState
          className="flex-1"
          iconSlot={<ScrollText className="size-5 text-icon3" aria-hidden />}
          titleSlot="No audit events yet"
          descriptionSlot="Board changes, runs, and git actions will appear here."
        />
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Audit events">
            {events.map(event => (
              <AuditEventRow key={event.id} event={event} />
            ))}
          </ul>
          {eventsQuery.hasNextPage ? (
            <Button
              variant="outline"
              size="sm"
              className="self-center"
              disabled={eventsQuery.isFetchingNextPage}
              onClick={() => void eventsQuery.fetchNextPage()}
            >
              {eventsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const target = event.targets[0];
  const hasMetadata = Object.keys(event.metadata).length > 0;

  return (
    <li className="rounded-lg border border-border1 bg-surface2 px-3 py-2">
      <div className="grid grid-cols-[4rem_10rem_1fr] items-baseline gap-3">
        <Txt as="span" variant="ui-xs" className="text-icon3" title={event.occurredAt}>
          {relativeTime(event.occurredAt)}
        </Txt>
        <span className="inline-flex w-fit rounded-md bg-surface4 px-1.5 py-0.5 text-ui-xs text-icon5">
          {actionLabel(event.action)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <Txt as="span" variant="ui-sm" className="truncate text-icon6">
            {target?.name ?? target?.id ?? '—'}
          </Txt>
          <Txt as="span" variant="ui-xs" className="text-icon3">
            {event.actorType === 'agent'
              ? `by agent${typeof event.metadata.startedBy === 'string' ? ` · started by ${event.metadata.startedBy}` : ''}`
              : `by ${event.actorId}`}
          </Txt>
        </div>
      </div>
      {hasMetadata ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-ui-xs text-icon3">Details</summary>
          <pre className="m-0 mt-1 overflow-x-auto rounded-md bg-surface1 p-2 text-ui-xs text-icon4">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </li>
  );
}
