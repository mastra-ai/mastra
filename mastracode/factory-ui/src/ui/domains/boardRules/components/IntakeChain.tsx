import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight, ListOrdered } from 'lucide-react';
import { Fragment } from 'react';
import { Link } from 'react-router';

import { boardIntakePath, boardRulesPath, INTAKE_ORDER_ANCHOR } from '../../boardConfig/boardConfigPaths';

/**
 * The boards a new issue or pull request is offered to, in intake order, with this board marked: boards asked before it get first pick,
 * and an item no board takes ends in Not routed. Each other board links to its rules; the order is changed on Routing.
 * While intake still runs the old route list, the order decides nothing yet, so none is drawn.
 */
export function IntakeChain({
  factoryId,
  boardKey,
  order,
  evaluator,
}: {
  factoryId: string;
  boardKey: string;
  order: readonly { boardKey: string; name: string }[];
  evaluator: 'route-list' | 'intake-order';
}) {
  const listed = order.some(board => board.boardKey === boardKey);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {evaluator === 'route-list' ? (
        <Txt as="p" variant="caption" tone="muted">
          Intake still files new issues and pull requests by the old route list, not by board.
        </Txt>
      ) : listed ? (
        <ol aria-label="Intake order" className="flex flex-wrap items-center gap-1">
          {order.map(board => (
            <Fragment key={board.boardKey}>
              <li>
                {board.boardKey === boardKey ? (
                  <Txt
                    as="span"
                    variant="caption"
                    tone="ink"
                    aria-current="step"
                    className="bg-surface3 rounded-md px-2 py-0.5 font-medium"
                  >
                    {board.name}
                  </Txt>
                ) : (
                  <Link
                    to={boardRulesPath(factoryId, board.boardKey)}
                    className="text-muted-foreground hover:text-foreground rounded-md px-2 py-0.5"
                  >
                    <Txt as="span" variant="caption">
                      {board.name}
                    </Txt>
                  </Link>
                )}
              </li>
              <ChevronRight aria-hidden className="text-muted-foreground size-icon-xs shrink-0" />
            </Fragment>
          ))}
          <li>
            <Txt as="span" variant="caption" tone="muted" className="px-2 py-0.5">
              Not routed
            </Txt>
          </li>
        </ol>
      ) : (
        <Txt as="p" variant="caption" tone="muted">
          Not in the intake order: new issues and pull requests never reach these rules.
        </Txt>
      )}
      <Link
        to={boardIntakePath(factoryId, boardKey, INTAKE_ORDER_ANCHOR)}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5"
      >
        <ListOrdered className="size-icon-xs shrink-0" aria-hidden />
        <Txt as="span" variant="caption" className="underline decoration-dotted underline-offset-2">
          Reorder
        </Txt>
      </Link>
    </div>
  );
}
