import type { ReactNode } from 'react';

import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';

export interface BoardCardRowsProps {
  /** The top-right group: the card's menu. */
  controls?: ReactNode;
  /** The meta line's parts, first and last kept whole when it truncates. */
  meta: ReactNode[];
  /** Links to related cards, after the meta line. */
  related?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  /** Upstream links, source state and labels. */
  details?: ReactNode;
  /** The other stages the card sits in. */
  otherStages?: string[];
  /** Status, session and review badges; left out when absent. */
  status?: ReactNode;
  /** The bottom row: actions and activity. */
  footer?: ReactNode;
}

/** A board card's rows as Factory lays them out, inside `BoardCard`. */
export function BoardCardRows({
  controls,
  meta,
  related,
  icon,
  title,
  details,
  otherStages = [],
  status,
  footer,
}: BoardCardRowsProps) {
  return (
    <>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">{controls}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5 pr-8">
          <Txt as="span" variant="meta" tone="faint" className="min-w-0 truncate">
            <Metadata singleLine>
              {meta.map((part, index, parts) => (
                <Metadata.Item
                  key={index}
                  className={index === 0 || index === parts.length - 1 ? 'shrink-0' : undefined}
                >
                  {part}
                </Metadata.Item>
              ))}
            </Metadata>
          </Txt>
          {related}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {icon}
          <Txt as="span" variant="card-title-tight" tone="ink" className="min-w-0 flex-1 truncate">
            {title}
          </Txt>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden">{details}</div>
      {otherStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {otherStages.map(stage => (
            <Txt
              as="span"
              variant="meta"
              tone="muted"
              key={stage}
              className="rounded-full border border-border px-2 py-0.5"
            >
              {stage}
            </Txt>
          ))}
        </div>
      )}
      {status ? <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">{status}</div> : null}
      {footer}
    </>
  );
}
