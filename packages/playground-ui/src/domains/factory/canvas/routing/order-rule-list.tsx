import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

/** One trigger new items arrive on, in an order card: its icon and the board's rules on it. */
export interface OrderRuleLane {
  event: string;
  /** The trigger's icon, shown when no rule listens on it. */
  icon: ReactNode;
  /** The board's rules on the trigger, in order, each an `OrderRuleRow` with its own key. */
  rules: readonly ReactNode[];
}

/** A board's rules for new issues and pull requests, trigger by trigger, checked in order. */
export function OrderRuleList({
  name,
  lanes,
  last,
  children,
}: {
  name: string;
  /** The arrival triggers with the board's rules on each; undefined while the rules load. */
  lanes: readonly OrderRuleLane[] | undefined;
  /** Last in the order: what no rule takes ends Not routed. */
  last: boolean;
  /** Rows after the rules. */
  children?: ReactNode;
}) {
  return (
    <ul aria-label={`${name} rules for new items`} className="flex flex-col gap-0.5">
      {lanes &&
        lanes.map(lane => {
          if (lane.rules.length === 0) {
            return (
              <li key={lane.event} className="flex h-5.5 items-center gap-1.5">
                {lane.icon}
                <Txt as="span" variant="caption" tone="muted">
                  {last ? 'No rules, ends Not routed' : 'No rules, goes to the next board'}
                </Txt>
              </li>
            );
          }
          return lane.rules;
        })}
      {children}
    </ul>
  );
}
