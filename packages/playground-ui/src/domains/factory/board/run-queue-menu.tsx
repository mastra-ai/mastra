import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Txt } from '@/ds/components/Txt';
import { IconHourglass } from '@/ds/icons/central/IconHourglass';
import type { LinkComponent } from '@/ds/types/link-component';

export interface RunQueueMenuRun {
  id: string;
  position: number;
  title: string;
  details: string[];
  queuedSince: { dateTime: string; label: string };
  /** Opens the card; a run whose card left the board has none. */
  href?: string;
}

export interface RunQueueMenuProps {
  queuedCount: number;
  replies: RunQueueMenuRun[];
  automated: RunQueueMenuRun[];
  /** Accessible summary of what runs right now, appended to the count. */
  running?: string;
  /** Slot usage lines; omitted when the host runs no Factory work. */
  slotLines?: string[];
  LinkComponent?: LinkComponent;
}

/**
 * How many runs wait for a run slot, opening the list oldest first: people's
 * replies first, since they are claimed ahead of automated runs.
 */
export function RunQueueMenu({
  queuedCount,
  replies,
  automated,
  running = '',
  slotLines = [],
  LinkComponent: Link = 'a',
}: RunQueueMenuProps) {
  if (queuedCount === 0) return null;
  const unlisted = queuedCount - replies.length - automated.length;

  const renderRun = (run: RunQueueMenuRun) => {
    const row = (
      <>
        <span className="w-7 shrink-0 tabular-nums">#{run.position}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{run.title}</span>
          <span className="flex min-w-0 gap-2">
            {run.details.map(detail => (
              <Txt key={detail} as="span" variant="caption" tone="muted" className="truncate">
                {detail}
              </Txt>
            ))}
            <Txt as="time" variant="caption" tone="muted" className="shrink-0" dateTime={run.queuedSince.dateTime}>
              {run.queuedSince.label}
            </Txt>
          </span>
        </span>
      </>
    );
    return run.href ? (
      <DropdownMenu.Item key={run.id} render={<Link href={run.href} />}>
        {row}
      </DropdownMenu.Item>
    ) : (
      <DropdownMenu.Item key={run.id} disabled>
        {row}
      </DropdownMenu.Item>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        variant="ghost"
        size="sm"
        aria-label={`${queuedCount} queued${running}`}
        tooltip={slotLines[0] ?? 'Runs waiting for a run slot'}
      >
        <IconHourglass aria-hidden />
        <span className="tabular-nums">{queuedCount} queued</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-[min(24rem,calc(100vw-1.5rem))]">
        {replies.length > 0 && <DropdownMenu.Label>Replies waiting</DropdownMenu.Label>}
        {replies.map(renderRun)}
        {automated.length > 0 && <DropdownMenu.Label>Waiting for a run slot, oldest first</DropdownMenu.Label>}
        {automated.map(renderRun)}
        {unlisted > 0 && <DropdownMenu.Label>And {unlisted} more</DropdownMenu.Label>}
        {slotLines.length > 0 && (
          <>
            <DropdownMenu.Separator />
            {slotLines.map(line => (
              <DropdownMenu.Label key={line}>{line}</DropdownMenu.Label>
            ))}
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
