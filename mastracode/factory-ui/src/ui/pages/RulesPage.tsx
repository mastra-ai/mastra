import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  Check,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleSlash,
  CircleX,
  Clock,
  ListFilter,
  RefreshCw,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { Fragment } from 'react';
import { useSearchParams } from 'react-router';

import { useFactoryDecisionAction, useFactoryDecisionHistory } from '../../hooks/useFactoryDecisions';
import { relativeTime } from '../../lib/date/relativeTime';
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
  { key: 'proposed', label: 'Awaiting approval', icon: CirclePause, statuses: ['proposed'] },
  { key: 'failed', label: 'Failed', icon: CircleX, statuses: ['failed'] },
  { key: 'succeeded', label: 'Succeeded', icon: CircleCheck, statuses: ['succeeded'] },
];

const STATUS_ICON: Record<FactoryDecisionStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleDashed, className: 'text-accent1' },
  proposed: { icon: CirclePause, className: 'text-accent6' },
  dismissed: { icon: CircleSlash, className: 'text-icon3' },
  superseded: { icon: CircleSlash, className: 'text-icon3' },
  leased: { icon: CircleDashed, className: 'text-accent1' },
  retry: { icon: CircleDashed, className: 'text-accent1' },
  succeeded: { icon: CircleCheck, className: 'text-green' },
  failed: { icon: CircleX, className: 'text-red' },
};

const STATUS_LABEL: Record<FactoryDecisionStatus, string> = {
  pending: 'queued',
  proposed: 'awaiting approval',
  dismissed: 'dismissed',
  superseded: 'superseded',
  leased: 'running',
  retry: 'retrying',
  succeeded: 'done',
  failed: 'failed',
};

/** Rule decisions and their durable queued effects for the active Factory. */
export function RulesPage() {
  return <FactoryPageShell>{project => <RulesContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

function RulesContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedGroup = searchParams.get('group');
  const decisionGroup = DECISION_GROUPS.find(entry => entry.key === requestedGroup)?.key ?? 'all';
  const decisionFilter = DECISION_GROUPS.find(entry => entry.key === decisionGroup);
  const decisionStatuses = decisionFilter?.statuses;
  const decisionsQuery = useFactoryDecisionHistory(factoryProjectId, decisionGroup, decisionStatuses);
  const retryDecision = useFactoryDecisionAction(factoryProjectId, 'retry');
  const approveDecision = useFactoryDecisionAction(factoryProjectId, 'approve');
  const dismissDecision = useFactoryDecisionAction(factoryProjectId, 'dismiss');
  const mutationError = [retryDecision, approveDecision, dismissDecision].find(mutation => mutation.isError)?.error;

  if (decisionsQuery.isError) {
    const message =
      decisionsQuery.error instanceof Error ? decisionsQuery.error.message : 'Unable to load rule decisions.';
    return <Notice variant="destructive">{message}</Notice>;
  }

  const decisions = decisionsQuery.data?.pages.flatMap(page => page.decisions) ?? [];
  const hasDecisionFilter = decisionGroup !== 'all';

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-labelledby="rule-decisions-heading">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <Txt as="h2" variant="ui-sm" className="text-icon6 m-0" id="rule-decisions-heading">
          Rule decisions
        </Txt>
        <div className="w-full lg:hidden">
          <Select
            value={decisionGroup}
            onValueChange={group => setSearchParams(group === 'all' ? {} : { group }, { replace: true })}
          >
            <SelectTrigger variant="outline" size="sm" aria-label="Rule decision filter" className="w-full">
              {decisionFilter?.label ?? 'All effects'}
            </SelectTrigger>
            <SelectContent>
              {DECISION_GROUPS.map(entry => (
                <SelectItem key={entry.key} value={entry.key}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ButtonsGroup className="hidden lg:flex" spacing="close" role="group" aria-label="Rule decision filter">
          {DECISION_GROUPS.map(entry => {
            const Icon = entry.icon;
            return (
              <Button
                key={entry.key}
                variant={decisionGroup === entry.key ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={decisionGroup === entry.key}
                onClick={() => setSearchParams(entry.key === 'all' ? {} : { group: entry.key }, { replace: true })}
              >
                <Icon aria-hidden />
                {entry.label}
              </Button>
            );
          })}
        </ButtonsGroup>
      </div>

      {mutationError !== undefined && (
        <Notice variant="destructive">
          {mutationError instanceof Error ? mutationError.message : 'Rule action failed'}
        </Notice>
      )}

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
              <Button variant="outline" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
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
                    approving={approveDecision.isPending && approveDecision.variables === decision.id}
                    dismissing={dismissDecision.isPending && dismissDecision.variables === decision.id}
                    onRetry={() => retryDecision.mutate(decision.id)}
                    onApprove={() => approveDecision.mutate(decision.id)}
                    onDismiss={() => dismissDecision.mutate(decision.id)}
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
  approving,
  dismissing,
  onRetry,
  onApprove,
  onDismiss,
}: {
  decision: FactoryDecisionSummary;
  retrying: boolean;
  approving: boolean;
  dismissing: boolean;
  onRetry: () => void;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const active =
    decision.status === 'pending' ||
    decision.status === 'leased' ||
    decision.status === 'retry' ||
    decision.status === 'proposed';
  const { icon: StatusIcon, className: statusIconClass } = STATUS_ICON[decision.status];
  const metrics: ReadonlyArray<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: Repeat, label: 'Attempts', value: String(decision.attempts) },
    { icon: Clock, label: 'Created', value: relativeTime(decision.createdAt) },
    decision.completedAt
      ? { icon: Check, label: 'Completed', value: relativeTime(decision.completedAt) }
      : { icon: RefreshCw, label: 'Updated', value: relativeTime(decision.updatedAt) },
  ];
  const actions =
    decision.status === 'proposed' ? (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={approving || dismissing} onClick={onDismiss}>
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </Button>
        <Button size="sm" disabled={approving || dismissing} onClick={onApprove}>
          {approving ? 'Starting…' : 'Run'}
        </Button>
      </div>
    ) : decision.status === 'failed' && decision.canRetry ? (
      <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    ) : null;

  return (
    <li className="hover:bg-neutral6/5 rounded-lg px-3 py-2 transition-colors">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
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
              {STATUS_LABEL[decision.status]}
            </span>
          </div>
          <div className="text-ui-sm leading-ui-sm lg:text-ui-xs lg:leading-ui-xs text-icon3 flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-1.5 lg:pt-0">
            {metrics.map(({ icon: MetricIcon, label, value }) => (
              <span key={label} className="inline-flex items-center gap-1" title={`${label}: ${value}`}>
                <MetricIcon className="size-3 shrink-0" aria-hidden />
                <span>{label}:</span>
                <span className="text-icon5">{value}</span>
              </span>
            ))}
          </div>
          {actions ? <div className="flex justify-start lg:hidden">{actions}</div> : null}
          {decision.lastError ? (
            <Txt as="span" variant="ui-xs" className="text-icon3 break-words">
              {decision.lastError}
            </Txt>
          ) : null}
        </div>
        <div className="hidden shrink-0 lg:block">{actions}</div>
      </div>
    </li>
  );
}
