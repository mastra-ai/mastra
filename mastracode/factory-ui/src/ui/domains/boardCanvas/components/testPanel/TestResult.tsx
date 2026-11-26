import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { IntakeTestResponse } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { phaseName } from '../../../boardRules/ruleTargets';
import { boardPath } from '../../../factory/boardCatalog';
import { eventLabel, moveRuleVerdictLabel, moveVerdictLabel } from '../../../intake/intakeCheckCopy';
import { BoardAnswers } from './BoardAnswers';

const KIND_LABEL: Record<IntakeTestResponse['item']['kind'], string> = {
  card: 'Card',
  not_routed: 'Not routed item',
  fetched: 'Read from its source, not filed',
};

/** `github.com/mastra-ai/mastra/issues/12` → `mastra-ai/mastra #12`; anything else as its host and path. */
function itemSource(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    if (host === 'github.com' && parts.length >= 4) return `${parts[0]}/${parts[1]} #${parts[3]}`;
    return `${host}${pathname}`;
  } catch {
    return url;
  }
}

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
  const { item, placement, current } = result;

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Txt as="p" variant="body-sm" tone="muted" className="flex min-w-0 items-center gap-2">
            {item.url?.startsWith('https://github.com/') && (
              <GithubIcon className="size-icon-sm shrink-0" aria-hidden />
            )}
            <span className="truncate">{item.url ? itemSource(item.url) : KIND_LABEL[item.kind]}</span>
          </Txt>
          {close}
        </div>
        <Txt as="h2" variant="card-title-strong">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </Txt>
        {item.url && (
          <Txt as="p" variant="caption" tone="muted">
            {KIND_LABEL[item.kind]}
          </Txt>
        )}
      </header>

      {placement ? (
        <div className="bg-fill flex items-center gap-2.5 rounded-2xl px-4 py-3">
          <IconCircleDashed className="size-icon-sm shrink-0" aria-hidden />
          <Txt as="p" variant="body-sm" tone="ink">
            Goes to {place(placement.boardKey, placement.phase)}
          </Txt>
        </div>
      ) : (
        <Notice variant="warning">{`Not routed. ${result.reason ?? ''}`}</Notice>
      )}
      {result.evaluator !== 'intake-order' && (
        <Notice variant="info">
          This project still files new issues and pull requests with the old route list, so filing may differ from this
          answer until it switches to intake order.
        </Notice>
      )}
      {result.note && (
        <Txt as="p" variant="caption" tone="muted">
          {result.note}
        </Txt>
      )}

      <BoardAnswers boards={result.boards} boardId={boardId} onEditRule={onEditRule} />

      {current && (
        <section aria-label="Its card" className="flex flex-col gap-2">
          <div className="flex justify-between gap-2">
            <Txt as="h3" variant="body-sm" tone="muted">
              Its card
            </Txt>
            <Txt as="span" variant="body-sm" tone="muted">
              {place(current.boardKey, current.phase)}
            </Txt>
          </div>
          {result.moves.length > 0 && (
            <>
              <ul aria-label="Card moves" className="flex flex-col gap-2">
                {result.moves.map((move, index) => {
                  const names = new Map(move.rules.map(rule => [rule.routeId, rule.name ?? 'Unnamed rule']));
                  const moveRuleName = (routeId: string) => names.get(routeId) ?? 'another rule';
                  return (
                    <li key={move.decisionId ?? `tried-${index}`} className="flex flex-col gap-1">
                      <div className="bg-fill flex flex-col rounded-2xl px-3 py-2.5">
                        <Txt as="span" variant="body-sm" tone="ink">
                          {eventLabel(move.event)}
                        </Txt>
                        <Txt as="span" variant="caption" tone="muted">
                          {moveVerdictLabel(move, boardName)}
                        </Txt>
                      </div>
                      {move.rules.map(rule => (
                        <div
                          key={rule.routeId}
                          className={cn(
                            'flex items-start gap-2 rounded-xl px-3 py-2',
                            rule.outcome === 'took' && 'bg-fill',
                          )}
                        >
                          <div className="flex min-w-0 flex-1 flex-col">
                            <Txt as="span" variant="body-sm" tone={rule.outcome === 'took' ? 'ink' : 'muted'}>
                              {moveRuleName(rule.routeId)}
                            </Txt>
                            <Txt as="span" variant="caption" tone="muted">
                              {moveRuleVerdictLabel(rule, moveRuleName)}
                            </Txt>
                          </div>
                          {(rule.outcome === 'took' || rule.outcome === 'lost') && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              tooltip="Edit rule"
                              aria-label={`Edit ${moveRuleName(rule.routeId)}`}
                              onClick={() => onEditRule(rule.routeId)}
                            >
                              <IconPencil />
                            </Button>
                          )}
                        </div>
                      ))}
                    </li>
                  );
                })}
              </ul>
              <Txt as="p" variant="caption" tone="muted">
                Replays run against the card's current phase and facts.
              </Txt>
            </>
          )}
        </section>
      )}

      {placement && (
        <Button
          variant="subtle"
          render={<Link to={boardPath(factoryId, placement.boardKey)} />}
          iconEnd={<IconArrowUpRight />}
          className="self-start"
        >
          {`Open ${boardName(placement.boardKey)}`}
        </Button>
      )}
    </>
  );
}
