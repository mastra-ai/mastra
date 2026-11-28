import { BUSY_CARD_MOVE_REFUSAL } from '@internal/factory-contract';
import {
  CardStageBar as SharedCardStageBar,
  boardCardState,
  canMoveTo,
  installedPhaseName,
  phaseIconKind,
  useItemDecisions,
  useBoardItems,
} from '@mastra/playground-ui/domains/factory';
import type { CardStagePhase, PullRequestSubscription } from '@mastra/playground-ui/domains/factory';
import { toast } from '@mastra/playground-ui/components/Toaster';

import type { InstalledBoardInfo, InstalledPhaseInfo } from '@mastra/client-js';
import { useCardSessions } from '@mastra/react/hooks/factory';
import { cardStages, elapsedLabel, enteredCurrentStageAt, stageBlockReason, stageDescription } from '../cardStageBar';
import type { StageStep } from '../cardStageBar';
import type { WorkItem } from '@internal/factory-contract';

export function CardPanelStageBar({
  item,
  sessionItems,
  board,
  factoryProjectId,
  currentUserId,
  repository,
  subscriptions,
  openContext,
}: {
  item: WorkItem;
  sessionItems: readonly WorkItem[];
  board: InstalledBoardInfo;
  factoryProjectId: string;
  currentUserId: string | undefined;
  /** The session's repository slug. */
  repository: string | undefined;
  subscriptions: readonly PullRequestSubscription[];
  openContext?: string;
}) {
  const { effectByItem } = useItemDecisions(factoryProjectId);
  const { move, evaluatingStages } = useBoardItems({
    factoryProjectId: factoryProjectId,
    kind: board.id,
    items: sessionItems,
    currentUserId,
    onFailure: message => toast.error(message),
  });
  const cardSessions = useCardSessions(factoryProjectId);
  const sessionHolds = cardSessions.current && cardSessions.held.has(item.id);
  const { owner } = boardCardState({ decision: effectByItem.get(item.id), sessionHolds });
  const stages = cardStages(item, board);
  const enteredAt = stages?.current.kind === 'working' ? enteredCurrentStageAt(item, stages.current.id) : undefined;
  if (!stages) return null;

  const held = (phase: InstalledPhaseInfo) => !canMoveTo(owner.kind, phase.kind);
  const shared = (phase: InstalledPhaseInfo, blockedReason?: string): CardStagePhase => ({
    id: phase.id,
    name: installedPhaseName(phase),
    kind: phaseIconKind(board.id, phase.kind),
    description: stageDescription(board, item, phase, openContext, { repository, subscriptions }),
    ...(blockedReason === undefined ? {} : { blockedReason }),
  });
  const option = (phase: InstalledPhaseInfo) => shared(phase, held(phase) ? BUSY_CARD_MOVE_REFUSAL : undefined);
  const neighbour = (step: StageStep | undefined) =>
    step && shared(step.phase, stageBlockReason(step) ?? (held(step.phase) ? BUSY_CARD_MOVE_REFUSAL : undefined));

  return (
    <SharedCardStageBar
      current={shared(stages.current)}
      track={stages.track.map(option)}
      stop={stages.stop.map(option)}
      previous={neighbour(stages.previous)}
      next={neighbour(stages.next)}
      enteredAt={enteredAt}
      moving={evaluatingStages.has(item.id)}
      elapsed={elapsedLabel}
      onMove={stage => move(item.id, stage)}
    />
  );
}
