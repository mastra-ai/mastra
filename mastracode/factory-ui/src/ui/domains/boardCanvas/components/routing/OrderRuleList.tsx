import { OrderRuleList as SharedOrderRuleList } from '@mastra/playground-ui/domains/factory';
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
  const lanes =
    lines &&
    ARRIVAL_EVENTS.map(event => ({
      event,
      icon: <LaneIcon event={event} />,
      rules: lines
        .filter(line => line.event === event)
        .map(line => <OrderRuleRow key={`${event}:${line.rule.id}`} line={line} board={board} onOpen={onOpenRule} />),
    }));

  return (
    <SharedOrderRuleList name={name} lanes={lanes} last={last}>
      {children}
    </SharedOrderRuleList>
  );
}
