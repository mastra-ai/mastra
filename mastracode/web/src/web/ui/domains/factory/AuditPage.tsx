import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CircleCheck, CircleDashed, CircleX, ListFilter, ScrollText, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { useAuditEvents, useAuditPortalLink } from '../../../../shared/hooks/useAuditEvents';
import { useFactoryDecisionHistory, useRetryFactoryDecision } from '../../../../shared/hooks/useFactoryDecisions';
import { relativeTime } from '../../../../shared/lib/date/relativeTime';
import { SkeletonRows } from '../../ui/SkeletonRows';
import { FactoryPageShell } from './components/FactoryPageShell';
import type { AuditEvent } from './services/audit';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from './services/decisions';

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
      'factory.work_item.transition_rejected',
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

const DECISION_GROUPS: ReadonlyArray<{
  key: string;
  label: string;
  icon: LucideIcon;
  statuses: FactoryDecisionStatus[] | undefined;
}> = [
  { key: 'all', label: 'All effects', icon: ListFilter, statuses: undefined },
  { key: 'active', label: 'Active', icon: CircleDashed, statuses: ['pending', 'leased', 'retry'] },
  { key: 'failed', label: 'Failed', icon: CircleX, statuses: ['failed'] },
  { key: 'succeeded', label: 'Succeeded', icon: CircleCheck, statuses: ['succeeded'] },
];

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
  const [decisionGroup, setDecisionGroup] = useState('all');
  const actionFilter = ACTION_GROUPS.find(entry => entry.key === group);
  const decisionFilter = DECISION_GROUPS.find(entry => entry.key === decisionGroup);
  const actions = actionFilter?.actions;
  const decisionStatuses = decisionFilter?.statuses;
  const eventsQuery = useAuditEvents(factoryProjectId, group, actions ? [...actions] : undefined);
  const decisionsQuery = useFactoryDecisionHistory(factoryProjectId, decisionGroup, decisionStatuses);
  const retryDecision = useRetryFactoryDecision(factoryProjectId);
  const portalQuery = useAuditPortalLink(true);

  if (eventsQuery.isError || decisionsQuery.isError) {
    const error = eventsQuery.error ?? decisionsQuery.error;
    return <Notice variant="destructive">{(error as Error).message}</Notice>;
  }

  const events = eventsQuery.data?.pages.flatMap(page => page.events) ?? [];
  const decisions = decisionsQuery.data?.pages.flatMap(page => page.decisions) ?? [];
  const hasActionFilter = group !== 'all';
  const hasDecisionFilter = decisionGroup !== 'all';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="flex min-h-0 flex-col gap-2" aria-labelledby="rule-decisions-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Txt as="h2" variant="ui-sm" className="m-0 text-icon6" id="rule-decisions-heading">
            Rule decisions
          </Txt>
          <ButtonsGroup spacing="close" role="group" aria-label="Rule decision filter">
            {DECISION_GROUPS.map(entry => {
              const Icon = entry.icon;
              return (
                <Button
                  key={entry.key}
                  variant={decisionGroup === entry.key ? 'primary' : 'outline'}
                  size="sm"
                  aria-pressed={decisionGroup === entry.key}
                  onClick={() => setDecisionGroup(entry.key)}
                >
                  <Icon aria-hidden />
                  {entry.label}
                </Button>
              );
            })}
          </ButtonsGroup>
        </div>

        {decisionsQuery.isPending ? (
          <SkeletonRows label="Loading rule decisions" rows={2} rowClassName="h-16 w-full" />
        ) : decisions.length === 0 ? (
          <EmptyState
            className="py-5"
            as="h3"
            iconSlot={<ListFilter className="size-5 text-icon3" aria-hidden />}
            titleSlot={hasDecisionFilter ? 'No matching rule effects' : 'No rule effects yet'}
            descriptionSlot={
              hasDecisionFilter
                ? `No rule effects match the “${decisionFilter?.label ?? 'selected'}” filter.`
                : 'Durable rule effects will appear here when a rule queues work.'
            }
            actionSlot={
              hasDecisionFilter ? (
                <Button variant="outline" size="sm" onClick={() => setDecisionGroup('all')}>
                  Show all effects
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ScrollArea maxHeight="min(14rem, 35vh)" className="min-h-0">
            <div className="flex flex-col gap-2 pr-1">
              <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Rule decisions">
                {decisions.map(decision => (
                  <DecisionRow
                    key={decision.id}
                    decision={decision}
                    retrying={retryDecision.isPending && retryDecision.variables === decision.id}
                    onRetry={() => retryDecision.mutate(decision.id)}
                  />
                ))}
              </ul>
              {decisionsQuery.hasNextPage ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-center"
                  disabled={decisionsQuery.isFetchingNextPage}
                  onClick={() => void decisionsQuery.fetchNextPage()}
                >
                  {decisionsQuery.isFetchingNextPage ? 'Loading…' : 'Load more effects'}
                </Button>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Audit history">
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

        {eventsQuery.isPending ? (
          <div className="min-h-0 flex-1">
            <SkeletonRows label="Loading audit events" rows={4} rowClassName="h-16 w-full" />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            className="min-h-0 flex-1"
            as="h2"
            iconSlot={<ScrollText className="size-5 text-icon3" aria-hidden />}
            titleSlot={hasActionFilter ? 'No matching audit events' : 'No audit events yet'}
            descriptionSlot={
              hasActionFilter
                ? `No audit events match the “${actionFilter?.label ?? 'selected'}” filter.`
                : 'Board changes, runs, and git actions will appear here.'
            }
            actionSlot={
              hasActionFilter ? (
                <Button variant="outline" size="sm" onClick={() => setGroup('all')}>
                  Show all events
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-2 pr-1">
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
            </div>
          </ScrollArea>
        )}
      </section>
    </div>
  );
}

function DecisionRow({
  decision,
  retrying,
  onRetry,
}: {
  decision: FactoryDecisionSummary;
  retrying: boolean;
  onRetry: () => void;
}) {
  const active = decision.status === 'pending' || decision.status === 'leased' || decision.status === 'retry';
  const detail = [
    `attempts ${decision.attempts}`,
    `created ${relativeTime(decision.createdAt)}`,
    decision.completedAt
      ? `completed ${relativeTime(decision.completedAt)}`
      : `updated ${relativeTime(decision.updatedAt)}`,
  ].join(' · ');
  return (
    <li className="rounded-lg border border-border1 bg-surface2 px-3 py-2">
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'inline-flex w-fit rounded-md bg-surface4 px-1.5 py-0.5 text-ui-xs',
            decision.status === 'failed' ? 'text-error' : active ? 'text-accent1' : 'text-icon5',
          )}
        >
          {decision.status}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Txt as="span" variant="ui-sm" className="text-icon6">
            {decision.type}
          </Txt>
          <Txt as="span" variant="ui-xs" className="text-icon3">
            {detail}
          </Txt>
          {decision.lastError ? (
            <Txt as="span" variant="ui-xs" className="break-words text-error">
              {decision.lastError}
            </Txt>
          ) : null}
        </div>
        {decision.status === 'failed' ? (
          <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
            {retrying ? 'Retrying…' : 'Retry'}
          </Button>
        ) : null}
      </div>
    </li>
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
