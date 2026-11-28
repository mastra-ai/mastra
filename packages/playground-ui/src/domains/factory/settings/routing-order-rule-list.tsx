import type { InstalledBoardInfo } from '@mastra/client-js';
import type { ReactNode } from 'react';

import { OrderRuleList as SharedOrderRuleList } from '..';
import type { RuleLine } from '..';
import { ARRIVAL_EVENTS } from './arrival-events';
import { LaneIcon } from './lane-icon';
import { RoutingOrderRuleRow } from './routing-order-rule-row';

/** A board's rules for new issues and pull requests, trigger by trigger, checked in order. */
export function RoutingOrderRuleList({
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
  const lanes =
    lines &&
    ARRIVAL_EVENTS.map(event => ({
      event,
      icon: <LaneIcon event={event} />,
      rules: lines
        .filter(line => line.event === event)
        .map(line => (
          <RoutingOrderRuleRow key={`${event}:${line.rule.id}`} line={line} board={board} onOpen={onOpenRule} />
        )),
    }));

  return (
    <SharedOrderRuleList name={name} lanes={lanes} last={last}>
      {children}
    </SharedOrderRuleList>
  );
}
