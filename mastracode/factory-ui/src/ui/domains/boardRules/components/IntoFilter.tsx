import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ListFilter } from 'lucide-react';
import { Link } from 'react-router';

/** Says the page shows only the rules moving cards into one phase, or away to other boards, with the way back. */
export function IntoFilter({
  count,
  into,
  leaving,
  showAll,
}: {
  /** Undefined when other boards' rules didn't load, so the page can't narrow and shows every rule. */
  count: number | undefined;
  into: string;
  leaving: boolean;
  showAll: string;
}) {
  const what = leaving ? `sending cards to ${into}` : `moving cards into ${into}`;
  return (
    <div className="border-border flex items-center gap-2 rounded-lg border px-3 py-2">
      <ListFilter className="size-icon-md text-muted-foreground shrink-0" aria-hidden />
      <Txt as="p" variant="body-sm" tone={count === undefined ? 'muted' : 'ink'} className="flex-1">
        {count === undefined
          ? `Couldn’t pick out the rules ${what}, so every rule is shown.`
          : count === 0
            ? `No rule is ${what}.`
            : `Only the ${count === 1 ? 'rule' : `${count} rules`} ${what}.`}
      </Txt>
      <Button size="sm" variant="ghost" render={<Link to={showAll} />}>
        Show all
      </Button>
    </div>
  );
}
