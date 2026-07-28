/**
 * Per-stage automation coverage for the Metrics page: what share of completed
 * passes through each stage was fully automated (entered and exited by
 * automation, first visit), and how the automated passes' items ended up.
 *
 * Each stage bar doubles as a toggle: selecting a stage with automated passes
 * reveals the concrete items behind its rate (the server ships them alongside
 * the counts), so a poor rate can be traced to the reworked items causing it.
 */

import { Badge } from '@mastra/playground-ui/components/Badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';

import type { AutomationOutcome, FactoryMetrics } from '../services/metrics';
import { BOARD_STAGES, stageLabel, stageOrder } from '../stages';

/** Terminal stages have no "pass through", so they never get automation rows. */
const TERMINAL_STAGE_IDS = new Set(['done', 'canceled']);

const EM_DASH = '—';

const OUTCOME_LABEL: Record<AutomationOutcome, string> = {
  done: 'Done',
  canceled: 'Canceled',
  reworked: 'Reworked',
  inFlight: 'In flight',
};

const OUTCOME_BADGE_VARIANT: Record<AutomationOutcome, 'success' | 'default' | 'warning' | 'info'> = {
  done: 'success',
  canceled: 'default',
  reworked: 'warning',
  inFlight: 'info',
};

/** Drill-down order: automation failures first, then still-open, then settled. */
const OUTCOME_ORDER: Record<AutomationOutcome, number> = { reworked: 0, inFlight: 1, done: 2, canceled: 3 };

export function StageAutomation({ metrics }: { metrics: FactoryMetrics }) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Rows only exist for stages with ≥1 exit, so an empty list means no stage
  // had a completed pass in the window.
  if (metrics.stageAutomation.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No completed stage passes in this window yet.
      </Txt>
    );
  }

  const rowsByStage = new Map(metrics.stageAutomation.map(row => [row.stage, row]));
  // Non-terminal board stages in column order, plus any stages present in the
  // data but unknown to the board (raw id, sorted last — same rule as
  // stageLabel/stageOrder).
  const stageIds = new Set<string>();
  for (const stage of BOARD_STAGES) {
    if (!TERMINAL_STAGE_IDS.has(stage.id)) stageIds.add(stage.id);
  }
  for (const row of metrics.stageAutomation) {
    stageIds.add(row.stage);
  }
  const stages = [...stageIds].sort((a, b) => stageOrder(a) - stageOrder(b));

  // A refetch can drop the selected stage's row (e.g. the range moved) —
  // render as unselected rather than holding a stale selection.
  const selectedRow = selectedStage ? rowsByStage.get(selectedStage) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {stages.map(stage => {
          const row = rowsByStage.get(stage);
          const exits = row?.exits ?? 0;
          const automated = row?.automated ?? 0;
          const pct = exits === 0 ? null : Math.round((automated / exits) * 100);
          const selectable = automated > 0;
          const isSelected = selectable && selectedStage === stage;
          const accessibleSummary =
            pct === null
              ? `${stageLabel(stage)}: no completed passes`
              : `${stageLabel(stage)}: ${automated} of ${exits} completed passes automated`;

          return (
            <li key={stage} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <Txt as="span" variant="ui-sm" className="font-medium text-icon5">
                  {stageLabel(stage)}
                </Txt>
                <Txt as="span" variant="ui-xs" className="text-right tabular-nums text-icon3">
                  {pct === null ? EM_DASH : `${pct}%`}
                </Txt>
              </div>
              <HoverCard>
                <HoverCardTrigger
                  render={
                    <button
                      type="button"
                      aria-label={accessibleSummary}
                      aria-pressed={selectable ? isSelected : undefined}
                      className={cn(
                        'h-2 w-full overflow-hidden rounded-full bg-surface4 p-0 outline-none focus-visible:ring-1 focus-visible:ring-border2',
                        selectable ? 'cursor-pointer' : 'cursor-help',
                        isSelected && 'ring-2 ring-border2',
                      )}
                      onClick={() => {
                        if (selectable) setSelectedStage(isSelected ? null : stage);
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Escape') setSelectedStage(null);
                      }}
                    >
                      {pct !== null && automated > 0 ? (
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.max(2, pct)}%`, backgroundColor: 'var(--chart-4)' }}
                        />
                      ) : null}
                    </button>
                  }
                />
                <HoverCardContent side="top" align="start" className="w-56 border-border2 bg-surface3 p-3 shadow-none">
                  <Txt as="p" variant="ui-sm" className="m-0 font-medium text-icon6">
                    {stageLabel(stage)}
                  </Txt>
                  <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-ui-xs">
                    <dt className="text-icon3">Completed passes</dt>
                    <dd className="m-0 tabular-nums text-icon5">{exits}</dd>
                    <dt className="text-icon3">Automated</dt>
                    <dd className="m-0 tabular-nums text-icon5">
                      {automated}
                      {pct === null ? '' : ` · ${pct}%`}
                    </dd>
                  </dl>
                  {row && automated > 0 ? (
                    <Txt as="p" variant="ui-xs" className="mt-2 mb-0 border-t border-border1 pt-2 text-icon3">
                      {outcomeSummary(row.outcomes)} — select to inspect
                    </Txt>
                  ) : null}
                </HoverCardContent>
              </HoverCard>
            </li>
          );
        })}
      </ul>
      {selectedRow ? <AutomatedItemsList row={selectedRow} /> : null}
    </div>
  );
}

/** Compact split of automated-pass outcomes, omitting zero buckets. */
function outcomeSummary(outcomes: FactoryMetrics['stageAutomation'][number]['outcomes']): string {
  const parts: string[] = [];
  if (outcomes.done > 0) parts.push(`${outcomes.done} done`);
  if (outcomes.canceled > 0) parts.push(`${outcomes.canceled} canceled`);
  if (outcomes.reworked > 0) parts.push(`${outcomes.reworked} reworked`);
  if (outcomes.inFlight > 0) parts.push(`${outcomes.inFlight} in flight`);
  return parts.join(', ');
}

/** The selected stage's automated passes, failures (reworked) first. */
function AutomatedItemsList({ row }: { row: FactoryMetrics['stageAutomation'][number] }) {
  const items = [...row.automatedItems].sort((a, b) => OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome]);
  return (
    <div className="flex flex-col gap-2 border-t border-border1 pt-4">
      <Txt as="p" variant="ui-sm" className="m-0 text-icon4">
        Automated through {stageLabel(row.stage).toLowerCase()} — {items.length} {items.length === 1 ? 'item' : 'items'}
      </Txt>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map(item => (
          <li
            key={item.id}
            className="flex min-w-0 flex-col gap-2 border-b border-border1 py-2.5 last:border-b-0 last:pb-0 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-ui-sm font-medium text-icon5 no-underline hover:text-icon6 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent1"
                >
                  {item.title}
                </a>
              ) : (
                <span className="block truncate text-ui-sm font-medium text-icon5">{item.title}</span>
              )}
            </div>
            <Badge size="xs" variant={OUTCOME_BADGE_VARIANT[item.outcome]}>
              {OUTCOME_LABEL[item.outcome]}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
