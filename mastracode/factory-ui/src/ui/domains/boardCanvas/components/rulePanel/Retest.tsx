import type { RuleRetestInfo } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo, IntakeDryRunBody, IntakeTestResponse } from '../../../../../api/types';
import { testBody, useIntakeTest, useIntakeTestQuery } from '../../../../../hooks/useIntakeDryRun';
import { boardName, phaseName } from '../../../boardRules/ruleTargets';

type DraftBoards = NonNullable<IntakeDryRunBody['boards']>;

/**
 * The item a test opened the rule from, run again on every change: where the unsaved rules would put it, and where
 * the saved ones do, re-tested after every rule change.
 */
export function useRetest(factoryId: string, subject: string | undefined) {
  const now = useIntakeTest(factoryId);
  const was = useIntakeTestQuery(factoryId, subject);
  const item = subject?.trim();

  const run = (boards: DraftBoards | undefined) => {
    if (!item) return;
    if (!boards) {
      now.reset();
      return;
    }
    now.mutate({ ...testBody(item), boards });
  };

  return { run, reset: now.reset, now: now.data, was: was.data };
}

function placed(result: IntakeTestResponse, boards: readonly InstalledBoardInfo[]): string {
  const placement = result.placement;
  if (!placement) return 'Not routed';
  const board = boards.find(candidate => candidate.id === placement.boardKey);
  if (!board) return placement.boardKey;
  return `${boardName(board)} › ${phaseName(board, placement.phase) ?? placement.phase}`;
}

/** Where the test's item goes under the unsaved rules, and where the saved ones put it; undefined before a retest. */
export function retestInfo(
  now: IntakeTestResponse | undefined,
  was: IntakeTestResponse | undefined,
  boards: readonly InstalledBoardInfo[],
): RuleRetestInfo | undefined {
  if (!now) return undefined;
  return { title: now.item.title, after: placed(now, boards), before: was ? placed(was, boards) : undefined };
}
