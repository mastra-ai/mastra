import { IntakeTestResult } from '@mastra/playground-ui/domains/factory';
import type { ReactNode } from 'react';

import type { IntakeTestResponse } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { HrefLink } from '../../../../ui/HrefLink';
import { phaseName } from '../../../boardRules/ruleTargets';
import { boardPath } from '../../../factory/boardCatalog';
import { eventLabel, moveRuleVerdictLabel, moveVerdictLabel, ruleVerdictLabel } from '../../../intake/intakeCheckCopy';

/** An intake test's answer, its boards' and phases' names resolved and every verdict put in words. */
export function TestResult({
  result,
  factoryId,
  boardId,
  close,
  onEditRule,
}: {
  result: IntakeTestResponse;
  factoryId: string;
  boardId: string;
  close: ReactNode;
  onEditRule: (routeId: string) => void;
}) {
  const boardName = (key: string) => result.boards.find(board => board.boardKey === key)?.name ?? key;
  const catalog = useBoardCatalog(factoryId).data ?? [];
  const place = (boardKey: string, phaseKey: string | null) => {
    if (!phaseKey) return boardName(boardKey);
    const board = catalog.find(candidate => candidate.id === boardKey);
    return `${boardName(boardKey)} › ${phaseName(board, phaseKey) ?? phaseKey}`;
  };
  const ruleNames = new Map(
    result.boards.flatMap(board =>
      board.rules.map(rule => [
        `${board.boardKey}\u0000${rule.routeId}`,
        `${board.name} › ${rule.name ?? 'Unnamed rule'}`,
      ]),
    ),
  );
  const ruleName = (key: string, routeId: string) => ruleNames.get(`${key}\u0000${routeId}`) ?? boardName(key);
  const { item, placement, current } = result;

  return (
    <IntakeTestResult
      result={{
        item,
        placement: placement && {
          place: place(placement.boardKey, placement.phase),
          boardName: boardName(placement.boardKey),
          boardHref: boardPath(factoryId, placement.boardKey),
        },
        reason: result.reason,
        legacyEvaluator: result.evaluator !== 'intake-order',
        note: result.note,
        boards: result.boards.map(board => ({
          boardKey: board.boardKey,
          name: board.name,
          rules: board.rules.map(rule => ({
            routeId: rule.routeId,
            name: rule.name,
            outcome: rule.outcome,
            verdict: ruleVerdictLabel(rule, ruleName),
          })),
        })),
        card: current && {
          place: place(current.boardKey, current.phase),
          moves: result.moves.map((move, index) => {
            const names = new Map(move.rules.map(rule => [rule.routeId, rule.name ?? 'Unnamed rule']));
            const moveRuleName = (routeId: string) => names.get(routeId) ?? 'another rule';
            return {
              key: move.decisionId ?? `tried-${index}`,
              event: eventLabel(move.event),
              verdict: moveVerdictLabel(move, boardName),
              rules: move.rules.map(rule => ({
                routeId: rule.routeId,
                name: moveRuleName(rule.routeId),
                outcome: rule.outcome,
                verdict: moveRuleVerdictLabel(rule, moveRuleName),
              })),
            };
          }),
        },
      }}
      boardId={boardId}
      close={close}
      LinkComponent={HrefLink}
      onEditRule={onEditRule}
    />
  );
}
