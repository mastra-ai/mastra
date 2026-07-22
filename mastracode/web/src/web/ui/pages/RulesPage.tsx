import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CircleCheck, CircleDashed, CircleX, ListFilter, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

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
        <SkeletonRows label="Loading rule decisions" rows={4} rowClassName="h-16 w-full" />
      ) : decisions.length === 0 ? (
        <EmptyState
          className="min-h-0 flex-1"
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
        <ScrollArea className="min-h-0 flex-1">
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
