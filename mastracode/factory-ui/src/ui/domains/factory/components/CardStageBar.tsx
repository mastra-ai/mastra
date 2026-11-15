import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useClock } from '@mastra/playground-ui/hooks/use-clock';
import { IconChevronBottom } from '@mastra/playground-ui/icons/central/IconChevronBottom';
import { IconChevronLeft } from '@mastra/playground-ui/icons/central/IconChevronLeft';
import { IconChevronRight } from '@mastra/playground-ui/icons/central/IconChevronRight';
import { useParams } from 'react-router';

import type { InstalledBoardInfo, InstalledPhaseInfo } from '../../../../api/types';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useSidebarWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { headerCapsuleClass } from '../../chat/components/chatPageHeader';
import { useThreadSubscriptions } from '../../chat/hooks/useThreadSubscriptions';
import type { FactoryProject } from '../../workspaces/services/github';
import { BUSY_CARD_MOVE_REFUSAL, boardCardState, canMoveTo } from '../boardCardState';
import { phaseName } from '../boardStages';
import { cardStages, elapsedLabel, enteredCurrentStageAt, stageBlockReason, stageDescription } from '../cardStageBar';
import type { StageStep } from '../cardStageBar';
import { useItemDecisions } from '../hooks/useBoardDecisions';
import { useItemSessionStatuses } from '../hooks/useItemSessionStatuses';
import { useBoardItems } from '../hooks/useBoardItems';
import { useRepositoryChoice } from '../hooks/useRepositoryChoice';
import { useSessionRepository } from '../hooks/useSessionRepository';
import type { WorkItem } from '../services/workItems';
import { BoardStageIcon, phaseIconKind } from './BoardIcons';
import { RepositoryPickerDialog } from './RepositoryPickerDialog';

const NO_SESSIONS: readonly string[] = [];

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
  const repositoryChoice = useRepositoryChoice(factory, board);
  const { threadId } = useParams<{ threadId: string }>();
  const { repository, provider } = useSessionRepository();
  const { subscriptions } = useThreadSubscriptions(threadId, repository !== undefined, provider);
  const parkedSessionIds = useSidebarWorkItemsQuery(factory.id).data?.parkedSessionIds ?? NO_SESSIONS;
  const sessionStatus = useItemSessionStatuses({ factoryProjectId: factory.id, items: [item], parkedSessionIds }).get(
    item.id,
  );
  const { owner } = boardCardState({ decision: effectByItem.get(item.id), sessionStatus });
  const stages = cardStages(item, board);
  const enteredAt = stages?.current.kind === 'working' ? enteredCurrentStageAt(item, stages.current.id) : undefined;
  const elapsed = useClock(now => (enteredAt === undefined ? undefined : elapsedLabel(enteredAt, now)));
  if (!stages) return null;

  const { current } = stages;
  const moving = evaluatingStages.has(item.id);
  const held = (phase: InstalledPhaseInfo) => !canMoveTo(owner.kind, phase.kind);
  const moveTo = (stage: string) =>
    void repositoryChoice.choose(
      item.source,
      { ...item.metadata, ...item.workItem?.metadata },
      stage,
      slug => move(item.id, stage, { repositorySlug: slug }),
      () => move(item.id, stage),
    );
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
            <IconChevronBottom aria-hidden />
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
      {repositoryChoice.pending ? (
        <RepositoryPickerDialog
          repositories={factory.repositories}
          onClose={repositoryChoice.cancel}
          onSelect={repository => repositoryChoice.select(repository.slug)}
        />
      ) : null}
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
      variant="ghost"
      size="sm"
      aria-label={reason ? `${action}, ${reason}` : action}
      tooltip={reason ?? action}
      disabled={disabled || held || step.blocked !== undefined}
      onClick={() => onMove(step.phase.id)}
    >
      {direction === 'previous' ? <IconChevronLeft aria-hidden /> : null}
      <span className="hidden @2xl:inline">{name}</span>
      {direction === 'next' ? <IconChevronRight aria-hidden /> : null}
    </Button>
  );
}
