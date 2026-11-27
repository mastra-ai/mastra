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
import type { CardStagePhase } from '@mastra/playground-ui/domains/factory';
import { toast } from '@mastra/playground-ui/components/Toaster';

import type { InstalledBoardInfo, InstalledPhaseInfo } from '../../../../api/types';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useCardSessions } from '@mastra/react/hooks/factory';
import type { FactoryProject } from '../../workspaces/services/github';
import { cardStages, elapsedLabel, enteredCurrentStageAt, stageBlockReason, stageDescription } from '../cardStageBar';
import type { StageStep } from '../cardStageBar';
import { useSessionSubscriptions } from '../hooks/useSessionSubscriptions';
import type { WorkItem } from '@internal/factory-contract';

export function CardStageBar({
  item,
  sessionItems,
  board,
  factory,
  openContext,
}: {
  item: WorkItem;
  sessionItems: readonly WorkItem[];
  board: InstalledBoardInfo;
  factory: FactoryProject;
  openContext?: string;
}) {
  const { effectByItem } = useItemDecisions(factory.id);
  const currentUserId = useFactoryAuth().data?.user?.userId;
  const { move, evaluatingStages } = useBoardItems({
    factoryProjectId: factory.id,
    kind: board.id,
    items: sessionItems,
    currentUserId,
    onFailure: message => toast.error(message),
  });
  const { session, links } = useSessionSubscriptions();
  const repository = session.repository;
  const subscriptions = links.subscriptions;
  const cardSessions = useCardSessions(factory.id);
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
    description: stageDescription(board, item, phase, openContext, { repository: repository?.slug, subscriptions }),
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
