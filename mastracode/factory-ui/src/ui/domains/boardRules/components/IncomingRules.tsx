import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, LogIn } from 'lucide-react';
import { Link } from 'react-router';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { boardRulesPath } from '../../boardConfig/boardConfigPaths';
import { boardName, phaseOptions } from '../ruleTargets';
import { ConditionChips } from './ConditionChips';
import { RuleTarget } from './RuleTarget';

/**
 * Rules on other boards that move their cards onto this one. They run on the other board's cards, so they are edited
 * there: each links to its board's rules.
 */
export function IncomingRules({
  factoryId,
  rules,
  board,
  boards,
}: {
  factoryId: string;
  rules: readonly IntakeRouteInfo[];
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
}) {
  return (
    <section aria-label="From other boards" className="border-border mt-3 flex flex-col gap-1.5 border-t pt-3">
      <Txt as="h4" variant="meta" tone="muted" className="flex items-center gap-1.5">
        <LogIn className="size-icon-xs shrink-0" aria-hidden />
        From other boards
      </Txt>
      <ul className="flex flex-col gap-1.5">
        {rules.map(rule => {
          const source = boards.find(candidate => candidate.id === rule.target.boardKey);
          return (
            <li key={rule.id}>
              <Link
                to={boardRulesPath(factoryId, rule.target.boardKey)}
                aria-label={`${rule.name}, on ${source ? boardName(source) : rule.target.boardKey}`}
                className={cn(
                  'group flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3',
                  !rule.enabled && 'opacity-50',
                )}
              >
                <span className="border-border group-hover:border-border-hover flex w-full min-w-0 flex-col gap-1 rounded-lg border border-dashed px-3 py-2 sm:flex-1">
                  <Txt as="span" variant="caption" tone="ink" className="truncate font-medium">
                    {source ? boardName(source) : `${rule.target.boardKey} (not installed)`}
                  </Txt>
                  <ConditionChips when={rule.when} options={phaseOptions(source)} everything="Every card" />
                </span>
                <span className="flex min-w-0 shrink-0 items-center">
                  <span aria-hidden className="border-border-strong h-0 w-8 shrink-0 border-t border-dashed" />
                  <ArrowRight aria-hidden className="text-muted-foreground size-icon-sm mr-2 -ml-1.5 shrink-0" />
                  <span className="flex w-44 shrink-0 items-center px-3 py-2">
                    <RuleTarget
                      boards={boards}
                      ownBoard={board.id}
                      boardKey={board.id}
                      phaseKey={rule.target.phaseKey}
                    />
                  </span>
                </span>
                {!rule.enabled && (
                  <Txt as="span" variant="caption" tone="muted">
                    Off
                  </Txt>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
