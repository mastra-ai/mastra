import type { RunQueueResponse } from '@mastra/client-js';
import { useBoardCatalog } from '@mastra/react/hooks/factory';
import { useBoardNavigation } from './board-navigation';
import { relativeTime } from './relative-time';
import { RunQueueMenu } from './run-queue-menu';
import type { RunQueueMenuRun } from './run-queue-menu';

type QueuedRun = RunQueueResponse['queued'][number];

function runLabel(run: QueuedRun): string {
  if (run.lane === 'interactive') return 'Reply from a person';
  if (run.skillName) return run.skillName;
  if (run.type === 'sendMessage') return 'Message to the session';
  if (run.type === 'signalActivity') return 'Pull request activity';
  return 'Prompt run';
}

function slotLines(slots: RunQueueResponse['slots']): string[] {
  if (!slots) return [];
  return [
    `${slots.inUse} of ${slots.cap} run slots in use on this server`,
    `${slots.interactive.inUse} of ${slots.interactive.cap} reply slots in use on this server`,
  ];
}

/** The board's run queue, linked to each queued card through the host's board navigation. */
export function RunQueueIndicator({ factoryId, queue }: { factoryId: string; queue: RunQueueResponse | undefined }) {
  const catalog = useBoardCatalog(factoryId);
  const { LinkComponent, boardCardHref } = useBoardNavigation();
  if (!queue) return null;

  const phaseName = (board: string | null, phase: string | null) => {
    const found = catalog.data?.find(definition => definition.id === board)?.phases.find(entry => entry.id === phase);
    return found?.name ?? found?.title ?? phase;
  };
  const toRun = (run: QueuedRun): RunQueueMenuRun => {
    const card = run.workItem;
    return {
      id: run.decisionId,
      position: run.position,
      title: card?.title ?? 'Card no longer on the board',
      details: [card?.key, runLabel(run), phaseName(card?.board ?? null, card?.phase ?? null)].filter(
        (detail): detail is string => Boolean(detail),
      ),
      queuedSince: { dateTime: run.queuedSince, label: relativeTime(run.queuedSince) },
      href: card?.board ? boardCardHref(card.board, card.id) : undefined,
    };
  };

  return (
    <RunQueueMenu
      queuedCount={queue.queuedCount}
      replies={queue.queued.filter(run => run.lane === 'interactive').map(toRun)}
      automated={queue.queued.filter(run => run.lane !== 'interactive').map(toRun)}
      running={queue.slots ? `, ${queue.slots.inUse + queue.slots.interactive.inUse} running on this server` : ''}
      slotLines={slotLines(queue.slots)}
      LinkComponent={LinkComponent}
    />
  );
}
