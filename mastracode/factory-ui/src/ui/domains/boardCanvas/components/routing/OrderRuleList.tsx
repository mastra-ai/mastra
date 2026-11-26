import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { InstalledBoardInfo } from '../../../../../api/types';
import type { RuleLine } from '../../canvasModel';
import { ARRIVAL_EVENTS, LaneIcon } from './laneIcon';
import { OrderRuleRow } from './OrderRuleRow';

/** A board's rules for new issues and pull requests, trigger by trigger, checked in order. */
export function OrderRuleList({
  name,
  lines,
  board,
  last,
  onOpenRule,
  children,
}: {
  name: string;
  /** The board's rule lines on the arrival triggers; undefined while the rules load. */
  lines: readonly RuleLine[] | undefined;
  board: InstalledBoardInfo | undefined;
  /** Last in the order: what no rule takes ends Not routed. */
  last: boolean;
  onOpenRule: (routeId: string) => void;
  /** Rows after the rules. */
  children?: ReactNode;
}) {
  return (
    <ul aria-label={`${name} rules for new items`} className="flex flex-col gap-0.5">
      {lines &&
        ARRIVAL_EVENTS.map(event => {
          const lane = lines.filter(line => line.event === event);
          if (lane.length === 0) {
            return (
              <li key={event} className="flex h-5.5 items-center gap-1.5">
                <LaneIcon event={event} />
                <Txt as="span" variant="caption" tone="muted">
                  {last ? 'No rules, ends Not routed' : 'No rules, goes to the next board'}
                </Txt>
              </li>
            );
          }
          return lane.map(line => (
            <OrderRuleRow key={`${event}:${line.rule.id}`} line={line} board={board} onOpen={onOpenRule} />
          ));
        })}
      {children}
    </ul>
  );
}
