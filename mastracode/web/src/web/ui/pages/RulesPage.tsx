import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  ListFilter,
  RefreshCw,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import { useFactoryDecisionHistory, useRetryFactoryDecision } from '../../../shared/hooks/useFactoryDecisions';
import { relativeTime } from '../../../shared/lib/date/relativeTime';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../domains/factory/services/decisions';
import { SkeletonRows } from '../ui/SkeletonRows';

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

const STATUS_ICON: Record<FactoryDecisionStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleDashed, className: 'text-accent1' },
  leased: { icon: CircleDashed, className: 'text-accent1' },
  retry: { icon: CircleDashed, className: 'text-accent1' },
  succeeded: { icon: CircleCheck, className: 'text-green' },
  failed: { icon: CircleX, className: 'text-red' },
};

/** Rule decisions and their durable queued effects for the active Factory. */
export function RulesPage() {
  return <FactoryPageShell>{project => <RulesContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

function RulesContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [decisionGroup, setDecisionGroup] = useState('all');
  const decisionFilter = DECISION_GROUPS.find(entry => entry.key === decisionGroup);
  const decisionStatuses = decisionFilter?.statuses;
  const decisionsQuery = useFactoryDecisionHistory(factoryProjectId, decisionGroup, decisionStatuses);
  const retryDecision = useRetryFactoryDecision(factoryProjectId);

  if (decisionsQuery.isError) {
    const message =
      decisionsQuery.error instanceof Error ? decisionsQuery.error.message : 'Unable to load rule decisions.';
    return <Notice variant="destructive">{message}</Notice>;
  }

  const decisions = decisionsQuery.data?.pages.flatMap(page => page.decisions) ?? [];
  const hasDecisionFilter = decisionGroup !== 'all';

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-labelledby="rule-decisions-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Txt as="h2" variant="ui-sm" className="text-icon6 m-0" id="rule-decisions-heading">
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
        <SkeletonRows label="Loading rule decisions" rows={4} rowClassName="h-16 w-full" />
      ) : decisions.length === 0 ? (
        <EmptyState
          className="min-h-0 flex-1"
          as="h3"
          iconSlot={<ListFilter className="text-icon3 size-5" aria-hidden />}
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
        <ScrollArea className="min-h-0 flex-1" revealScrollbarOnHover={false}>
          <div className="flex flex-col gap-2 pr-1">
            <ul className="m-0 flex list-none flex-col p-0" aria-label="Rule decisions">
              {decisions.map((decision, index) => (
                <Fragment key={decision.id}>
                  {index > 0 ? <li role="separator" aria-hidden className="bg-border1 mx-3 my-px h-px" /> : null}
                  <DecisionRow
                    decision={decision}
                    retrying={retryDecision.isPending && retryDecision.variables === decision.id}
                    onRetry={() => retryDecision.mutate(decision.id)}
                  />
                </Fragment>
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
  const { icon: StatusIcon, className: statusIconClass } = STATUS_ICON[decision.status];
  const metrics: ReadonlyArray<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: Repeat, label: 'attempts', value: String(decision.attempts) },
    { icon: Clock, label: 'created', value: relativeTime(decision.createdAt) },
    decision.completedAt
      ? { icon: Check, label: 'completed', value: relativeTime(decision.completedAt) }
      : { icon: RefreshCw, label: 'updated', value: relativeTime(decision.updatedAt) },
  ];

  return (
    <li className="hover:bg-neutral6/5 rounded-lg px-3 py-2 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('size-3 shrink-0', statusIconClass)} aria-hidden />
            <Txt as="span" variant="ui-sm" className="text-icon6">
              {decision.type}
            </Txt>
            <span
              className={cn(
                'inline-flex w-fit rounded-md bg-surface4 px-1.5 py-0.5 text-ui-xs',
                decision.status === 'failed' ? 'text-error' : active ? 'text-accent1' : 'text-icon5',
              )}
            >
              {decision.status}
            </span>
          </div>
          <div className="text-ui-xs leading-ui-xs text-icon3 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {metrics.map(({ icon: MetricIcon, label, value }) => (
              <span key={label} className="inline-flex items-center gap-1" title={`${label} ${value}`}>
                <MetricIcon className="size-3 shrink-0" aria-hidden />
                {value}
              </span>
            ))}
          </div>
          {decision.lastError ? (
            <Txt as="span" variant="ui-xs" className="text-icon3 break-words">
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
