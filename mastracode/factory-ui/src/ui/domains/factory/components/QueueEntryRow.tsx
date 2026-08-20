import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { QueueHealthEntry } from '../queue-health';

/** One card in the live queue, wherever it is listed. */
export function QueueEntryRow({
  entry,
  detail,
  trailing,
}: {
  entry: QueueHealthEntry;
  detail: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li
      // rule sits in the 1px gap below the row — rounded hover bg never meets it
      className={`hover:bg-surface4 after:bg-border1 has-[a:focus-visible]:outline-accent1 relative mb-px flex min-w-0 items-center gap-3 rounded-md px-2 py-2 transition-colors after:absolute after:inset-x-2 after:-bottom-px after:h-px last:mb-0 last:after:hidden has-[a:focus-visible]:outline-2 ${entry.url ? 'cursor-pointer' : ''}`}
    >
      <span className="min-w-0 flex-1">
        {entry.url ? (
          // stretched link — the whole row is the hit area
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="text-ui-sm text-icon5 hover:text-icon6 block truncate no-underline after:absolute after:inset-0 hover:underline focus-visible:outline-none"
          >
            {entry.title}
          </a>
        ) : (
          <span className="text-ui-sm text-icon5 block truncate">{entry.title}</span>
        )}
        <Txt as="span" variant="ui-xs" className="text-icon3 mt-0.5 block">
          {detail}
        </Txt>
      </span>
      {entry.active ? (
        <span role="img" aria-label="Agent running" className="bg-accent1 inline-flex size-1.5 shrink-0 rounded-full" />
      ) : null}
      {trailing}
    </li>
  );
}
