import type { ReactNode } from 'react';
import { Avatar } from '@/ds/components/Avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';
import { IconHistory } from '@/ds/icons/central/IconHistory';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

export interface CardActivityActor {
  name: string;
  avatarUrl?: string;
}

/** One line of a card's activity, already named and labelled by the host. */
export interface CardActivityEntry {
  id: string;
  actor: CardActivityActor;
  /** Shown beside the actor, e.g. the model an agent ran. */
  detail?: string;
  /** What happened. Rendered as given: the host decides wording and casing. */
  label: ReactNode;
  /** Leave out when the label already carries the time. */
  time?: { dateTime: string; label: ReactNode };
}

export function CardActivityEvent({ entry, className }: { entry: CardActivityEntry; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <Avatar src={entry.actor.avatarUrl} name={entry.actor.name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Txt as="span" variant="meta" tone="ink" className="truncate">
          <Metadata singleLine>
            <Metadata.Item>{entry.actor.name}</Metadata.Item>
            {entry.detail && (
              <Metadata.Item>
                <Txt as="span" variant="meta" tone="muted">
                  {entry.detail}
                </Txt>
              </Metadata.Item>
            )}
          </Metadata>
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="flex items-baseline justify-between gap-3">
          <span className="min-w-0">{entry.label}</span>
          {entry.time && (
            <time className="shrink-0" dateTime={entry.time.dateTime}>
              {entry.time.label}
            </time>
          )}
        </Txt>
      </div>
    </div>
  );
}

/** Who last worked on a card, opening the card's recent activity on hover. */
export function CardActivity({
  worker,
  entries,
  showName = true,
}: {
  worker: CardActivityActor;
  /** Newest first. */
  entries: readonly CardActivityEntry[];
  showName?: boolean;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={
          <button
            type="button"
            draggable={false}
            aria-label={`View activity by ${worker.name}`}
            onPointerDown={event => event.stopPropagation()}
            className={cn(
              'text-muted-foreground',
              `relative flex min-w-0 items-center gap-1.5 rounded-full hover:text-foreground ${focusRing}`,
            )}
          >
            {showName && (
              <Txt as="span" variant="meta" className="max-w-32 truncate">
                {worker.name}
              </Txt>
            )}
            <Avatar src={worker.avatarUrl} name={worker.name} size="sm" interactive />
          </button>
        }
      />
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        showArrow={false}
        className="w-80 max-w-[calc(100vw-2rem)]"
        aria-label="Work item activity"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconHistory className="size-icon-sm text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Txt as="span" variant="column" tone="ink">
                Activity
              </Txt>
              <Txt as="span" variant="meta" tone="muted" className="truncate">
                Last worked on by {worker.name}
              </Txt>
            </div>
          </div>
          {entries.length > 0 ? (
            <ol className="flex flex-col gap-2.5">
              {entries.map(entry => (
                <li key={entry.id}>
                  <CardActivityEvent entry={entry} />
                </li>
              ))}
            </ol>
          ) : (
            <Txt as="span" variant="meta" tone="muted">
              No recorded activity yet.
            </Txt>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
