import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useClock } from '@mastra/playground-ui/hooks/use-clock';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import type { InstalledBoardInfo, InstalledPhaseInfo } from '../../../../api/types';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { FactoryProject } from '../../workspaces/services/github';
import { BUSY_CARD_MOVE_REFUSAL, boardCardState, canMoveTo } from '../boardCardState';
import {
  cardStages,
  elapsedLabel,
  enteredCurrentStageAt,
  phaseName,
  stageBlockReason,
  stageDescription,
} from '../cardStageBar';
import type { StageStep } from '../cardStageBar';
import { useItemDecisions } from '../hooks/useBoardDecisions';
import { useBoardItems } from '../hooks/useBoardItems';
import { useRepositoryChoice } from '../hooks/useRepositoryChoice';
import type { WorkItem } from '../services/workItems';
import { BoardStageIcon, phaseIconKind } from './BoardIcons';
import { RepositoryPickerDialog } from './RepositoryPickerDialog';

/**
 * The card's place on its board, from the session header: the phases either side of it, and a
 * menu of every phase the board lets it move to, each saying what the move does.
 */
export function CardStageBar({
  item,
  sessionItems,
  board,
  factory,
  openContext,
}: {
  item: WorkItem;
  /** The session's cards, which the move reads the card's latest revision from. */
  sessionItems: readonly WorkItem[];
  board: InstalledBoardInfo;
  factory: FactoryProject;
  /** The context of the session on screen. */
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
  // An effect automation is working through holds back moves that would start another run, as on the board.
  const { owner } = boardCardState({ decision: effectByItem.get(item.id) });
  const stages = cardStages(item, board);
  // The clock answers "how long has Factory been at it". A card waiting in a resting phase such as Intake,
  // or finished in a terminal one, has nothing running, so its stage shows no time.
  const enteredAt = stages?.current.kind === 'working' ? enteredCurrentStageAt(item, stages.current.id) : undefined;
  // Draws again only when the label changes, about once a minute.
  const elapsed = useClock(now => (enteredAt === undefined ? undefined : elapsedLabel(enteredAt, now)));
  if (!stages) return null;

  const { current } = stages;
  const moving = evaluatingStages.has(item.id);
  const held = (phase: InstalledPhaseInfo) => !canMoveTo(owner.kind, phase.kind);
  const notes = [...stages.forward, ...stages.back, ...stages.stop].some(held)
    ? [...stages.notes, BUSY_CARD_MOVE_REFUSAL]
    : stages.notes;
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
  const groups = [
    { label: 'Forward', phases: stages.forward },
    { label: stages.stopped ? 'Reopen' : 'Back', phases: stages.back },
    { label: 'Stop', phases: stages.stop },
  ].filter(group => group.phases.length > 0);

  return (
    <>
      {/* One raised capsule, like a segmented control's track: the neighbours sit flat in it and
          the current phase is the filled segment, so the bar reads as a single control. */}
      <div
        role="group"
        aria-label="Card stage"
        className={cn(raisedSurfaceStyle, 'flex w-fit items-center gap-0.5 rounded-full p-0.5')}
      >
        {stages.previous ? (
          <NeighbourButton
            direction="previous"
            step={stages.previous}
            reason={stageBlockReason(item, current, stages.previous)}
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
            <ChevronDown aria-hidden />
          </DropdownMenu.Trigger>
          {/* Every move with its description, the Stop group and the footer note fit without scrolling. */}
          <DropdownMenu.Content align="center" className="max-h-(--available-height) w-80">
            {/* The trigger above already names the phase and its time; the menu opens on what that means. */}
            <Txt variant="meta" tone="muted" className="px-2 pt-1.5 pb-2">
              {stageDescription(board, item, current, openContext)}
            </Txt>
            {groups.map(group => (
              <StageGroup key={group.label} label={group.label}>
                {group.phases.map(phase => (
                  <DropdownMenu.Item
                    key={phase.id}
                    aria-label={`Move to ${phaseName(phase)}`}
                    variant={group.label === 'Stop' ? 'destructive' : 'default'}
                    className="items-start"
                    disabled={held(phase)}
                    onClick={() => moveTo(phase.id)}
                  >
                    {icon(phase)}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{phaseName(phase)}</span>
                      <Txt as="span" variant="meta" tone="muted">
                        {stageDescription(board, item, phase, openContext)}
                      </Txt>
                    </div>
                  </DropdownMenu.Item>
                ))}
              </StageGroup>
            ))}
            {notes.length > 0 ? (
              <>
                <DropdownMenu.Separator />
                <div className="flex flex-col gap-0.5 px-2 pt-1 pb-1.5">
                  {notes.map(note => (
                    <Txt key={note} variant="meta" tone="muted">
                      {note}
                    </Txt>
                  ))}
                </div>
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu>
        {stages.next ? (
          <NeighbourButton
            direction="next"
            step={stages.next}
            reason={stageBlockReason(item, current, stages.next)}
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

function StageGroup({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <>
      <DropdownMenu.Separator />
      <DropdownMenu.Group aria-labelledby={labelId}>
        <DropdownMenu.Label id={labelId}>{label}</DropdownMenu.Label>
        {children}
      </DropdownMenu.Group>
    </>
  );
}

/**
 * The nearest phase the card enters on one side; its name folds away when the header is narrow, and one held back says why.
 * `held` marks a move automation working the card keeps back.
 */
function NeighbourButton({
  direction,
  step,
  reason,
  held,
  disabled,
  onMove,
}: {
  direction: 'previous' | 'next';
  step: StageStep;
  reason: string | undefined;
  held: boolean;
  disabled: boolean;
  onMove: (stage: string) => void;
}) {
  const name = phaseName(step.phase);
  const action = direction === 'previous' ? `Move back to ${name}` : `Move to ${name}`;
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={action}
      tooltip={reason ?? (held ? BUSY_CARD_MOVE_REFUSAL : action)}
      disabled={disabled || held || step.blocked !== undefined}
      onClick={() => onMove(step.phase.id)}
    >
      {direction === 'previous' ? <ChevronLeft aria-hidden /> : null}
      <span className="hidden @2xl:inline">{name}</span>
      {direction === 'next' ? <ChevronRight aria-hidden /> : null}
    </Button>
  );
}
