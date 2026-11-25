import { RunQueueMenu } from '@mastra/playground-ui/domains/factory';
import type { RunQueueMenuRun } from '@mastra/playground-ui/domains/factory';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { HrefLink } from '../../../ui/HrefLink';
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

function slotLines(slots: RunQueueResponse['slots']): string[] {
  if (!slots) return [];
  return [
    `${slots.inUse} of ${slots.cap} run slots in use on this server`,
    `${slots.interactive.inUse} of ${slots.interactive.cap} reply slots in use on this server`,
  ];
}

export function RunQueueIndicator({ factoryId, queue }: { factoryId: string; queue: RunQueueResponse | undefined }) {
  const catalog = useBoardCatalog(factoryId);
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
      href: card?.board
        ? factoryAttentionTargetPath(factoryId, { kind: 'work-item', workItemId: card.id, board: card.board })
        : undefined,
    };
  };

  return (
    <RunQueueMenu
      queuedCount={queue.queuedCount}
      replies={queue.queued.filter(run => run.lane === 'interactive').map(toRun)}
      automated={queue.queued.filter(run => run.lane !== 'interactive').map(toRun)}
      running={queue.slots ? `, ${queue.slots.inUse + queue.slots.interactive.inUse} running on this server` : ''}
      slotLines={slotLines(queue.slots)}
      LinkComponent={HrefLink}
    />
  );
}
