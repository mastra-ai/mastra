import type { RuleDryRun } from './types';
import { Txt } from '@/ds/components/Txt';

/** What a rule that files new items did lately: filed for real, and would take of the newest items now. */
export function RuleStats({ ruleId, dryRun }: { ruleId: string; dryRun: RuleDryRun | undefined }) {
  const stats = dryRun?.boards.flatMap(board => board.rules).find(candidate => candidate.routeId === ruleId);
  if (!dryRun || !stats) return null;
  const lost = stats.lost.filter(entry => entry.keys.length > 0);
  const rows: [string, string][] = [
    ['Filed · 30 days', String(stats.filed)],
    [`Last ${dryRun.sampled} items`, `${stats.takes.length} landed here`],
    ...lost.map((entry, index): [string, string] => [
      index === 0 ? 'Taken first' : '',
      `${entry.keys.length} by ${dryRun.boards.find(board => board.boardKey === entry.boardKey)?.name ?? entry.boardKey}`,
    ]),
  ];

  return (
    <dl className="flex flex-col gap-1.5">
      {rows.map(([label, value]) => (
        <div key={`${label}:${value}`} className="flex items-baseline justify-between gap-3">
          <dt>
            <Txt as="span" variant="caption" tone="muted">
              {label}
            </Txt>
          </dt>
          <dd>
            <Txt as="span" variant="caption" className="tabular-nums">
              {value}
            </Txt>
          </dd>
        </div>
      ))}
    </dl>
  );
}
