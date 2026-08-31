import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import {
  useDismissFactoryDecisions,
  useFactoryDecisionAction,
  useFactoryDecisionStatus,
} from '../../../../hooks/useFactoryDecisions';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { relativeTime } from '../../../../lib/date/relativeTime';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { FactoryDecisionStatus, FactoryDecisionSummary } from '../services/decisions';
import { PANEL, PANEL_ROW, PANEL_ROW_LINK, TIMESTAMP } from './panel';

const PROPOSED: FactoryDecisionStatus[] = ['proposed'];

interface ProposalGroup {
  key: string;
  label: string;
  decisions: FactoryDecisionSummary[];
}

/** A rules engine proposes the same run for every card it matches: thirty rows reading `invokeSkill · triage` are one decision. */
function groupProposals(decisions: FactoryDecisionSummary[]): ProposalGroup[] {
  const groups = new Map<string, FactoryDecisionSummary[]>();
  for (const decision of decisions) {
    const key = `${decision.type}:${decision.role ?? ''}`;
    const open = groups.get(key);
    if (open) open.push(decision);
    else groups.set(key, [decision]);
  }
  return [...groups].map(([key, grouped]) => ({
    key,
    label: grouped[0].role
      ? `${grouped.length} ${grouped[0].role} ${grouped.length === 1 ? 'run' : 'runs'}`
      : `${grouped.length} × ${grouped[0].type}`,
    decisions: grouped,
  }));
}

/** Runs the Factory holds until someone says yes — a pile of what has not happened, so not the rail's timeline. */
export function ApprovalQueue({ factoryId, total }: { factoryId: string; total: number }) {
  const proposals = useFactoryDecisionStatus(factoryId, PROPOSED);
  const items = useWorkItemsQuery(factoryId);
  const [expanded, setExpanded] = useState<string>();
  const [confirming, setConfirming] = useState<string>();
  const approve = useFactoryDecisionAction(factoryId, 'approve');
  const dismiss = useFactoryDecisionAction(factoryId, 'dismiss');
  const dismissAll = useDismissFactoryDecisions(factoryId);

  const decisions = proposals.data?.decisions;
  const groups = groupProposals(decisions ?? []);
  const titleById = new Map((items.data ?? []).map(item => [item.id, item.title]));

  if (proposals.isPending)
    return <SkeletonRows label="Loading runs waiting for approval" rows={2} rowClassName="h-10 w-full" />;
  if (proposals.isError) {
    return (
      <Notice variant="destructive">
        <span>Unable to load runs waiting for approval.</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => void proposals.refetch()}>
          Try again
        </Button>
      </Notice>
    );
  }
  if (groups.length === 0) return null;

  const loaded = decisions?.length ?? 0;

  return (
    <section aria-labelledby="approval-queue-heading" className={cn(PANEL, 'flex flex-col gap-1 p-2')}>
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <h2 id="approval-queue-heading" className="text-ui-sm text-icon6 m-0 font-medium">
          Waiting for approval
        </h2>
        <span className="bg-surface4 text-ui-xs text-icon3 min-w-5 rounded-full px-1.5 py-0.5 text-center leading-none font-medium tabular-nums">
          {total}
        </span>
        {/* The route pages by `created_at desc`, so a truncated queue shows its newest end. */}
        {loaded < total ? <span className={cn(TIMESTAMP, 'ml-auto')}>newest {loaded} shown</span> : null}
      </div>

      {groups.map(group => {
        const open = expanded === group.key;
        // Only the tail of a complete queue is the true oldest; on a truncated
        // one it is the oldest of what loaded, which is a different claim.
        const oldest = loaded < total ? undefined : group.decisions.at(-1);
        return (
          <div key={group.key} className="flex flex-col">
            <div className={cn(PANEL_ROW, 'hover:bg-surface4 transition-colors')}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setExpanded(open ? undefined : group.key);
                  setConfirming(undefined);
                }}
                className="focus-visible:outline-accent1 flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:outline-2"
              >
                {open ? (
                  <ChevronDown className="text-icon3 size-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronRight className="text-icon3 size-4 shrink-0" aria-hidden />
                )}
                <Txt as="span" variant="ui-sm" className="text-icon6 min-w-0 truncate font-medium">
                  {group.label}
                </Txt>
              </button>
              {oldest ? (
                <span className={cn(TIMESTAMP, 'shrink-0')}>oldest {relativeTime(oldest.createdAt)}</span>
              ) : null}
              <Button
                variant="ghost"
                size="xs"
                disabled={dismissAll.isPending}
                onClick={() => {
                  if (confirming !== group.key) return setConfirming(group.key);
                  setConfirming(undefined);
                  dismissAll.mutate(
                    group.decisions.map(decision => decision.id),
                    { onError: () => toast.error('Unable to dismiss every run') },
                  );
                }}
              >
                {confirming === group.key ? `Dismiss ${group.decisions.length}?` : 'Dismiss all'}
              </Button>
            </div>

            {open ? (
              <ul className="m-0 flex list-none flex-col p-0 pl-7">
                {group.decisions.map(decision => (
                  <li key={decision.id} className={cn(PANEL_ROW_LINK, 'gap-2')}>
                    <Txt as="span" variant="ui-sm" className="text-icon5 min-w-0 flex-1 truncate">
                      {(decision.workItemId ? titleById.get(decision.workItemId) : undefined) ?? decision.type}
                    </Txt>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={dismiss.variables === decision.id && dismiss.isPending}
                      onClick={() =>
                        dismiss.mutate(decision.id, { onError: () => toast.error('Unable to dismiss the run') })
                      }
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="xs"
                      disabled={approve.variables === decision.id && approve.isPending}
                      onClick={() =>
                        approve.mutate(decision.id, { onError: () => toast.error('Unable to start the run') })
                      }
                    >
                      Run
                    </Button>
                    <time
                      dateTime={decision.createdAt}
                      className={cn(TIMESTAMP, 'w-10 shrink-0 text-right tabular-nums')}
                    >
                      {relativeTime(decision.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
