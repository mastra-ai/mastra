import type { ReactNode } from 'react';

import { Txt } from '@/ds/components/Txt';

/** The list row's title cell. */
export function ListRowTitle({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="label" tone="ink" className="truncate font-[550] tracking-tight">
      {children}
    </Txt>
  );
}

/** The list row's links cell: a native card's key as text, then upstream and related links. */
export function ListRowLinks({ nativeKey, children }: { nativeKey?: string; children?: ReactNode }) {
  return (
    <>
      {nativeKey !== undefined && (
        <Txt as="span" variant="meta" tone="faint" className="truncate">
          {nativeKey}
        </Txt>
      )}
      {children}
    </>
  );
}

/** The list row's labels cell: upstream author, then state badge and labels. */
export function ListRowLabels({ author, children }: { author?: string | null; children?: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {author && (
        <Txt as="span" variant="meta" tone="faint">
          {author}
        </Txt>
      )}
      {children}
    </span>
  );
}

/** The list row's status cell. */
export function ListRowStatus({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 items-center gap-2">{children}</span>;
}
