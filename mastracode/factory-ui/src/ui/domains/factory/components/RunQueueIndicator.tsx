import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Hourglass } from 'lucide-react';
import { Link } from 'react-router';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import type { RunQueueResponse } from '../services/decisions';
import { factoryAttentionTargetPath } from '../services/attention';

type QueuedRun = RunQueueResponse['queued'][number];

function runLabel(run: QueuedRun): string {
  if (run.lane === 'interactive') return 'Reply from a person';
  if (run.skillName) return run.skillName;
  if (run.type === 'sendMessage') return 'Message to the session';
  if (run.type === 'signalActivity') return 'Pull request activity';
  return 'Prompt run';
}

function slotsLabel(slots: RunQueueResponse['slots']): string | undefined {
  return slots ? `${slots.inUse} of ${slots.cap} run slots in use on this server` : undefined;
}

function replySlotsLabel(slots: NonNullable<RunQueueResponse['slots']>): string {
  return `${slots.interactive.inUse} of ${slots.interactive.cap} reply slots in use on this server`;
}

/**
 * How many runs wait for a run slot, opening the list oldest first: people's
 * replies first, since they are claimed ahead of automated runs.
 */
export function RunQueueIndicator({ factoryId, queue }: { factoryId: string; queue: RunQueueResponse | undefined }) {
  const catalog = useBoardCatalog(factoryId);
  if (!queue || queue.queuedCount === 0) return null;

  const phaseName = (board: string | null, phase: string | null) =>
    catalog.data?.find(definition => definition.id === board)?.phases.find(entry => entry.id === phase)?.title ?? phase;
  const running = queue.slots ? `, ${queue.slots.inUse} running on this server` : '';
  const unlisted = queue.queuedCount - queue.queued.length;
  const replies = queue.queued.filter(run => run.lane === 'interactive');
  const automated = queue.queued.filter(run => run.lane !== 'interactive');
  const renderRun = (run: QueuedRun) => {
    const card = run.workItem;
    const details = [card?.key, runLabel(run), phaseName(card?.board ?? null, card?.phase ?? null)].filter(
      (detail): detail is string => Boolean(detail),
    );
    const row = (
      <>
        <span className="w-7 shrink-0 tabular-nums">#{run.position}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{card?.title ?? 'Card no longer on the board'}</span>
          <span className="flex min-w-0 gap-2">
            {details.map(detail => (
              <Txt key={detail} as="span" variant="caption" tone="muted" className="truncate">
                {detail}
              </Txt>
            ))}
            <Txt as="time" variant="caption" tone="muted" className="shrink-0" dateTime={run.queuedSince}>
              {relativeTime(run.queuedSince)}
            </Txt>
          </span>
        </span>
      </>
    );
    return card?.board ? (
      <DropdownMenu.Item
        key={run.decisionId}
        render={
          <Link
            to={factoryAttentionTargetPath(factoryId, {
              kind: 'work-item',
              workItemId: card.id,
              board: card.board,
            })}
          />
        }
      >
        {row}
      </DropdownMenu.Item>
    ) : (
      <DropdownMenu.Item key={run.decisionId} disabled>
        {row}
      </DropdownMenu.Item>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        variant="ghost"
        size="sm"
        aria-label={`${queue.queuedCount} queued${running}`}
        tooltip={slotsLabel(queue.slots) ?? 'Runs waiting for a run slot'}
      >
        <Hourglass aria-hidden />
        <span className="tabular-nums">{queue.queuedCount} queued</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-[min(24rem,calc(100vw-1.5rem))]">
        {replies.length > 0 && <DropdownMenu.Label>Replies waiting</DropdownMenu.Label>}
        {replies.map(renderRun)}
        {automated.length > 0 && <DropdownMenu.Label>Waiting for a run slot, oldest first</DropdownMenu.Label>}
        {automated.map(renderRun)}
        {unlisted > 0 && <DropdownMenu.Label>And {unlisted} more</DropdownMenu.Label>}
        {queue.slots && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>{slotsLabel(queue.slots)}</DropdownMenu.Label>
            <DropdownMenu.Label>{replySlotsLabel(queue.slots)}</DropdownMenu.Label>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
