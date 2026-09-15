import { Badge, type BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import {
  Brain,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleSlash,
  CircleX,
  ListFilter,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

import { useFactoryDecisionAction, useFactoryDecisionHistory } from '../../hooks/useFactoryDecisions';
import { relativeTime } from '../../lib/date/relativeTime';
import { dayHeading, groupByDay } from '../domains/factory/activity';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { LoadMoreSentinel } from '../domains/factory/components/LoadMoreSentinel';
import { supervisorAskPath } from '../domains/supervisor/services/supervisor';
import { TIMESTAMP } from '../domains/factory/components/panel';
import { DayHeading, RailRow, RAIL_LIST, RAIL_MARK_TONE, RAIL_ROW_BODY } from '../domains/factory/components/Timeline';
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

const STATUS_STYLE: Record<
  FactoryDecisionStatus,
  { icon: LucideIcon; tone: BadgeVariant; label: string; live?: true }
> = {
  pending: { icon: CircleDashed, tone: 'blue', label: 'queued' },
  proposed: { icon: CirclePause, tone: 'yellow', label: 'awaiting approval' },
  dismissed: { icon: CircleSlash, tone: 'neutral', label: 'dismissed' },
  superseded: { icon: CircleSlash, tone: 'neutral', label: 'superseded' },
  leased: { icon: CircleDashed, tone: 'cyan', label: 'running', live: true },
  retry: { icon: CircleDashed, tone: 'orange', label: 'retrying', live: true },
  succeeded: { icon: CircleCheck, tone: 'green', label: 'done' },
  failed: { icon: CircleX, tone: 'red', label: 'failed' },
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
  const nowMs = Date.now();
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
          <div className="flex flex-col gap-8 pt-2 pr-1">
            {groupByDay(decisions.map(decision => ({ decision, at: Date.parse(decision.createdAt) }))).map(day => (
              <section key={day.dayMs} className="flex flex-col gap-5">
                <DayHeading>{dayHeading(day.dayMs, nowMs)}</DayHeading>
                <ul className={RAIL_LIST}>
                  {day.items.map(({ decision }, index) => {
                    const { icon: StatusIcon, tone } = STATUS_STYLE[decision.status];
                    return (
                      <RailRow
                        key={decision.id}
                        connected={index < day.items.length - 1}
                        mark={<StatusIcon size={14} className={RAIL_MARK_TONE[tone]} aria-hidden />}
                      >
                        <DecisionRow
                          factoryProjectId={factoryProjectId ?? ''}
                          decision={decision}
                          retrying={retryDecision.isPending && retryDecision.variables === decision.id}
                          approving={approveDecision.isPending && approveDecision.variables === decision.id}
                          dismissing={dismissDecision.isPending && dismissDecision.variables === decision.id}
                          onRetry={() => retryDecision.mutate(decision.id)}
                          onApprove={() => approveDecision.mutate(decision.id)}
                          onDismiss={() => dismissDecision.mutate(decision.id)}
                        />
                      </RailRow>
                    );
                  })}
                </ul>
              </section>
            ))}
            <LoadMoreSentinel
              hasNextPage={decisionsQuery.hasNextPage}
              isFetchingNextPage={decisionsQuery.isFetchingNextPage}
              onLoadMore={() => void decisionsQuery.fetchNextPage()}
              label="Load more effects"
            />
          </div>
        </ScrollArea>
      )}
    </section>
  );
}

function DecisionRow({
  factoryProjectId,
  decision,
  retrying,
  approving,
  dismissing,
  onRetry,
  onApprove,
  onDismiss,
}: {
  factoryProjectId: string;
  decision: FactoryDecisionSummary;
  retrying: boolean;
  approving: boolean;
  dismissing: boolean;
  onRetry: () => void;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();
  const { tone, label, live } = STATUS_STYLE[decision.status];
  const progress = decision.completedAt
    ? `Completed ${relativeTime(decision.completedAt)}`
    : `Updated ${relativeTime(decision.updatedAt)}`;

  return (
    <div className={cn('flex min-h-7 min-w-0 items-center gap-2 py-0.5', RAIL_ROW_BODY)}>
      <Txt as="span" variant="ui-sm" className="text-icon6 shrink-0 truncate font-medium">
        {decision.type}
      </Txt>
      <Badge size="xs" variant={tone} emphasis="muted" {...(live ? { indicator: 'pulse' as const } : {})}>
        {label}
      </Badge>
      {decision.attempts > 1 ? (
        <Badge size="xs" variant="neutral" emphasis="muted" icon={<Repeat aria-hidden />} title="Attempts">
          {decision.attempts}
        </Badge>
      ) : null}
      {decision.lastError ? (
        <Txt as="span" variant="ui-xs" className="text-icon3 min-w-0 flex-1 truncate" title={decision.lastError}>
          {decision.lastError}
        </Txt>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {decision.status === 'failed' ? (
          <Button
            variant="ghost"
            size="icon-xs"
            tooltip="Ask supervisor"
            aria-label={`Ask supervisor about failed ${decision.type} decision`}
            onClick={() =>
              void navigate(
                supervisorAskPath(
                  factoryProjectId,
                  `Explain why rule decision ${decision.id} failed and recommend the safest repair.`,
                ),
              )
            }
          >
            <Brain aria-hidden />
          </Button>
        ) : null}
        {decision.status === 'proposed' ? (
          <>
            <Button variant="ghost" size="xs" disabled={approving || dismissing} onClick={onDismiss}>
              {dismissing ? 'Dismissing…' : 'Dismiss'}
            </Button>
            <Button size="xs" disabled={approving || dismissing} onClick={onApprove}>
              {approving ? 'Starting…' : 'Run'}
            </Button>
          </>
        ) : decision.status === 'failed' && decision.canRetry ? (
          <Button variant="outline" size="xs" disabled={retrying} onClick={onRetry}>
            {retrying ? 'Retrying…' : 'Retry'}
          </Button>
        ) : null}
        <time dateTime={decision.createdAt} className={cn(TIMESTAMP, 'shrink-0')} title={progress}>
          {relativeTime(decision.createdAt)}
        </time>
      </div>
    </div>
  );
}
