import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { ruleCount } from '../../boardRules/ruleLanes';
import { RuleRow } from './RuleRow';

/**
 * A count of rules that opens the Rules page, and on hover or focus lists them: what fires each one, the board it
 * lives on or sends cards to when that is another board, and the cards it takes.
 */
export function RuleCountCard({
  rules,
  title,
  to,
  boardId,
  boards,
}: {
  rules: readonly IntakeRouteInfo[];
  title: string;
  to: string;
  /** The board being shown, so rules from elsewhere name their board. */
  boardId: string;
  boards: readonly InstalledBoardInfo[] | undefined;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={<Link to={to} />}
        className={cn(focusRing, 'w-fit rounded-sm underline decoration-dotted underline-offset-2')}
      >
        {ruleCount(rules.length)}
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        showArrow={false}
        className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        <Txt as="span" variant="caption" tone="faint">
          {title}
        </Txt>
        <ul aria-label={title} className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {rules.map(rule => (
            <RuleRow key={rule.id} rule={rule} boardId={boardId} boards={boards} />
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
