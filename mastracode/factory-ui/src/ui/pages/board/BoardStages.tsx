import type { BoardPhaseKind } from '@mastra/factory/boards';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { DragPayload } from '../../domains/factory/boardDrag';
import type { BoardLayout } from '../../domains/factory/boardLayout';
import { BoardTooltipDelay } from '../../domains/factory/components/BoardCardParts';
import { BOARD_COLUMNS_CLASS, BOARD_LIST_BODY_CLASS, BoardFrame } from '../../domains/factory/components/BoardFrame';
import { BoardColumn, BoardColumnHeader } from '../../domains/factory/components/BoardColumn';
import { BoardList, BoardListGroup } from '../../domains/factory/components/BoardList';
import { BoardStageCreateButton } from '../../domains/factory/components/BoardStageCreateButton';
import type { BoardStageCreate } from '../../domains/factory/components/BoardStageCreateButton';
import { BoardScrollContext } from '../../domains/factory/context/BoardScrollContext';

export interface BoardStageView {
  stage: { id: string; label: string };
  phaseKind?: BoardPhaseKind;
  /** Who works the phase's cards and how its work ends, when it has an agent or an exit tool. */
  setup?: ReactNode;
  taskCount: number;
  loading: boolean;
  collapsed: boolean;
  groupOpen: boolean;
  onGroupOpenChange: (open: boolean) => void;
  /** Set when the stage takes a new card by hand. */
  create?: BoardStageCreate;
  cards: ReactNode;
}

export function BoardStages({
  layout,
  stages: stageViews,
  totalTaskCount,
  onDrop,
  toolbar,
}: {
  layout: BoardLayout;
  stages: BoardStageView[];
  totalTaskCount: number;
  onDrop: (payload: DragPayload, stage: string) => void;
  toolbar: ReactNode;
}) {
  // State, not a ref: groups mount before this ancestor's ref attaches, so they must re-render once it does.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  return (
    <BoardScrollContext value={scrollElement}>
      <BoardFrame
        ref={setScrollElement}
        layout={layout}
        toolbar={toolbar}
        onPointerOver={event =>
          setHoveredStage(
            event.target instanceof Element
              ? (event.target.closest('[data-board-stage]')?.getAttribute('data-board-stage') ?? null)
              : null,
          )
        }
        onPointerLeave={() => setHoveredStage(null)}
        columnHeaders={stageViews.map(stageView => (
          <BoardColumnHeader
            key={stageView.stage.id}
            phaseKind={stageView.phaseKind}
            stage={stageView.stage.id}
            label={stageView.stage.label}
            taskCount={stageView.taskCount}
            totalTaskCount={totalTaskCount}
            loading={stageView.loading}
            collapsed={stageView.collapsed}
            hovered={hoveredStage === stageView.stage.id}
            headerAction={
              stageView.collapsed &&
              stageView.create && (
                <BoardStageCreateButton stage={stageView.stage} shape="column" {...stageView.create} />
              )
            }
            headerExtras={stageView.setup}
          />
        ))}
      >
        <BoardTooltipDelay>
          {layout === 'board' ? (
            <div role="group" aria-label="Board columns" className={BOARD_COLUMNS_CLASS}>
              {stageViews.map(stageView => (
                <BoardColumn
                  key={stageView.stage.id}
                  stage={stageView.stage.id}
                  label={stageView.stage.label}
                  collapsed={stageView.collapsed}
                  hovered={hoveredStage === stageView.stage.id}
                  action={
                    stageView.create && (
                      <BoardStageCreateButton stage={stageView.stage} shape="row" {...stageView.create} />
                    )
                  }
                  onDrop={onDrop}
                >
                  {stageView.cards}
                </BoardColumn>
              ))}
            </div>
          ) : (
            <div className={BOARD_LIST_BODY_CLASS}>
              <BoardList aria-label="Board stages">
                {stageViews.map(stageView => (
                  <BoardListGroup
                    key={stageView.stage.id}
                    stage={stageView.stage.id}
                    label={stageView.stage.label}
                    phaseKind={stageView.phaseKind}
                    count={stageView.taskCount}
                    loading={stageView.loading}
                    open={stageView.groupOpen}
                    onOpenChange={stageView.onGroupOpenChange}
                    action={
                      stageView.create && (
                        <BoardStageCreateButton stage={stageView.stage} shape="icon" {...stageView.create} />
                      )
                    }
                    extras={stageView.setup}
                    onDrop={onDrop}
                  >
                    {stageView.cards}
                  </BoardListGroup>
                ))}
              </BoardList>
            </div>
          )}
        </BoardTooltipDelay>
      </BoardFrame>
    </BoardScrollContext>
  );
}
