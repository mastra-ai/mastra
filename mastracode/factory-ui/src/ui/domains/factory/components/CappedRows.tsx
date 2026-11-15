import { Button } from '@mastra/playground-ui/components/Button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

const SHOWN_ROWS = 4;

export function CappedRows<T>({ items, render }: { items: readonly T[]; render: (item: T) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  // One row over the cap shows outright: a button to reveal a single row would take that row's space.
  const capped = items.length > SHOWN_ROWS + 1;
  const shown = capped && !expanded ? items.slice(0, SHOWN_ROWS) : items;
  return (
    <>
      {shown.map(render)}
      {capped ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full justify-start"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown className={expanded ? 'rotate-180' : undefined} />
          {expanded ? 'Show fewer' : `Show ${items.length - SHOWN_ROWS} more`}
        </Button>
      ) : null}
    </>
  );
}
