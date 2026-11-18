import { Button } from '@mastra/playground-ui/components/Button';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ListFilter } from 'lucide-react';
import { Link } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { phaseName } from '../ruleTargets';

/** Says the page shows only the rules moving cards into one phase, or away to other boards, with the way back. */
export function IntoFilter({
  count,
  pending = false,
  board,
  into,
  leaving,
  showAll,
}: {
  /** Undefined when other boards' rules didn't load, so the page can't narrow and shows every rule. */
  count: number | undefined;
  pending?: boolean;
  board: InstalledBoardInfo | undefined;
  into: string | undefined;
  leaving: boolean;
  showAll: string;
}) {
  const target = leaving || !into ? 'other boards' : (phaseName(board, into) ?? into);
  const what = leaving ? `sending cards to ${target}` : `moving cards into ${target}`;
  return (
    <div className="border-border flex items-center gap-2 rounded-lg border px-3 py-2">
      <ListFilter className="size-icon-md text-muted-foreground shrink-0" aria-hidden />
      {pending ? (
        <span aria-hidden className="flex-1">
          <SkeletonText line="text-body-sm" className="w-64 max-w-full motion-reduce:before:animate-none" />
        </span>
      ) : (
        <Txt as="p" variant="body-sm" tone={count === undefined ? 'muted' : 'ink'} className="flex-1">
          {count === undefined
            ? `Couldn’t pick out the rules ${what}, so every rule is shown.`
            : count === 0
              ? `No rule is ${what}.`
              : `Only the ${count === 1 ? 'rule' : `${count} rules`} ${what}.`}
        </Txt>
      )}
      <Button size="sm" variant="ghost" render={<Link to={showAll} />}>
        Show all
      </Button>
    </div>
  );
}
