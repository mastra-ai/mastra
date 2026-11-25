import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useClock } from '@mastra/playground-ui/hooks/use-clock';

import type { InstalledBoardInfo, InstalledPhaseInfo } from '../../../../api/types';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useCardSessions } from '../../../../hooks/useSessionRows';
import { headerCapsuleClass } from '../../chat/components/chatPageHeader';
import type { FactoryProject } from '../../workspaces/services/github';
import { BUSY_CARD_MOVE_REFUSAL, boardCardState, canMoveTo } from '../boardCardState';
import { phaseName } from '../boardStages';
import { cardStages, elapsedLabel, enteredCurrentStageAt, stageBlockReason, stageDescription } from '../cardStageBar';
import type { StageStep } from '../cardStageBar';
import { useItemDecisions } from '../hooks/useBoardDecisions';
import { useBoardItems } from '../hooks/useBoardItems';
import { useSessionSubscriptions } from '../hooks/useSessionSubscriptions';
import type { WorkItem } from '../services/workItems';
import { BoardStageIcon, phaseIconKind } from './BoardIcons';
import { IconChevronDownMedium } from '@mastra/playground-ui/icons/central/IconChevronDownMedium';
import { IconChevronLeftMedium } from '@mastra/playground-ui/icons/central/IconChevronLeftMedium';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';

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
  const elapsed = useClock(now => (enteredAt === undefined ? undefined : elapsedLabel(enteredAt, now)));
  if (!stages) return null;

  const { current } = stages;
  const moving = evaluatingStages.has(item.id);
  const held = (phase: InstalledPhaseInfo) => !canMoveTo(owner.kind, phase.kind);
  const moveTo = (stage: string) => move(item.id, stage);
  const icon = (phase: InstalledPhaseInfo) => (
    <BoardStageIcon stage={phase.id} kind={phaseIconKind(board.id, phase.kind)} decorative />
  );
  const option = (phase: InstalledPhaseInfo) => {
    const own = phase.id === current.id;
    return (
      <DropdownMenu.RadioItem
        key={phase.id}
        value={phase.id}
        closeOnClick
        aria-label={own ? `${phaseName(phase)}, current stage` : `Move to ${phaseName(phase)}`}
        className="items-start"
        disabled={!own && held(phase)}
      >
        {icon(phase)}
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{phaseName(phase)}</span>
          {own ? null : (
            <Txt as="span" variant="meta" tone="muted">
              {held(phase)
                ? BUSY_CARD_MOVE_REFUSAL
                : stageDescription(board, item, phase, openContext, { repository: repository?.slug, subscriptions })}
            </Txt>
          )}
        </div>
      </DropdownMenu.RadioItem>
    );
  };

  return (
    <>
      <div role="group" aria-label="Card stage" className={headerCapsuleClass}>
        {stages.previous ? (
          <NeighbourButton
            direction="previous"
            step={stages.previous}
            held={held(stages.previous.phase)}
            disabled={moving}
            onMove={moveTo}
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenu.Trigger
            variant="subtle"
            size="sm"
            aria-label={`Change stage from ${phaseName(current)}`}
            disabled={moving}
          >
            {icon(current)}
            <span>{phaseName(current)}</span>
            {elapsed ? (
              <Txt as="span" variant="meta" tone="muted" font="mono">
                {elapsed}
              </Txt>
            ) : null}
            <IconChevronDownMedium aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="center" className="max-h-(--available-height) w-72">
            <DropdownMenu.RadioGroup
              value={current.id}
              onValueChange={(stage: string) => {
                if (stage !== current.id) moveTo(stage);
              }}
            >
              {stages.track.map(option)}
              {stages.track.length > 0 && stages.stop.length > 0 ? <DropdownMenu.Separator /> : null}
              {stages.stop.map(option)}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu>
        {stages.next ? (
          <NeighbourButton
            direction="next"
            step={stages.next}
            held={held(stages.next.phase)}
            disabled={moving}
            onMove={moveTo}
          />
        ) : null}
      </div>
    </>
  );
}

function NeighbourButton({
  direction,
  step,
  held,
  disabled,
  onMove,
}: {
  direction: 'previous' | 'next';
  step: StageStep;
  held: boolean;
  disabled: boolean;
  onMove: (stage: string) => void;
}) {
  const name = phaseName(step.phase);
  const action = direction === 'previous' ? `Move back to ${name}` : `Move to ${name}`;
  const reason = stageBlockReason(step) ?? (held ? BUSY_CARD_MOVE_REFUSAL : undefined);
  return (
    <Button
      iconEnd={direction === 'next' ? <IconChevronRightMedium /> : undefined}
      icon={direction === 'previous' ? <IconChevronLeftMedium /> : undefined}
      variant="ghost"
      size="sm"
      aria-label={reason ? `${action}, ${reason}` : action}
      tooltip={reason ?? action}
      disabled={disabled || held || step.blocked !== undefined}
      onClick={() => onMove(step.phase.id)}
    >
      <span className="hidden @2xl:inline">{name}</span>
    </Button>
  );
}
