import type { BoardPhaseKind } from '@mastra/factory/boards';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import type { DragPayload } from '../../domains/factory/boardDrag';
import type { BoardLayout } from '../../domains/factory/boardLayout';
import { BoardTooltipDelay } from '../../domains/factory/components/BoardCardParts';
import { BoardColumn, BoardColumnHeader } from '../../domains/factory/components/BoardColumn';
import { BoardDetailsDock } from '../../domains/factory/components/BoardDetailsDock';
import { BoardList, BoardListGroup } from '../../domains/factory/components/BoardList';
import { BoardOpenCardContext } from '../../domains/factory/context/BoardOpenCardContext';
import { BoardScrollContext } from '../../domains/factory/context/BoardScrollContext';
import { useOpenCardState } from '../../domains/factory/hooks/useOpenCardState';
import type { LinkedComment } from '../../domains/factory/hooks/useOpenCardState';

export interface BoardStageView {
  stage: { id: string; label: string };
  phaseKind?: BoardPhaseKind;
  taskCount: number;
  loading: boolean;
  collapsed: boolean;
  groupOpen: boolean;
  onGroupOpenChange: (open: boolean) => void;
  createButton?: ReactNode;
  cards: ReactNode;
}

export function BoardStages({
  layout,
  stages: stageViews,
  totalTaskCount,
  linkedComment,
  onDrop,
  toolbar,
}: {
  layout: BoardLayout;
  stages: BoardStageView[];
  totalTaskCount: number;
  /** A `?item&comment` link, which opens its card. */
  linkedComment: LinkedComment | undefined;
  onDrop: (payload: DragPayload, stage: string) => void;
  toolbar: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const openCard = useOpenCardState(linkedComment);
  return (
    <BoardScrollContext value={scrollRef}>
      <BoardOpenCardContext value={openCard}>
        <BoardDetailsDock enabled={layout === 'list'}>
          <div
            ref={scrollRef}
            className="[container-type:inline-size] m-px min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-auto overscroll-x-contain rounded-[calc(var(--studio-frame-radius,1.5rem)-1px)] lg:overscroll-x-auto"
          >
            <div className={cn('flex min-h-full min-w-full flex-col gap-3', layout === 'board' ? 'w-max' : 'w-full')}>
              <div className="from-background via-background z-20 flex flex-col gap-3 bg-linear-to-b via-[calc(100%-1rem)] to-transparent pb-4 max-lg:contents lg:sticky lg:top-0">
                <div className="sticky left-0 flex w-[100cqw] px-4 pt-4">{toolbar}</div>
                {layout === 'board' && (
                  <div className="from-background via-background sticky top-0 z-20 flex items-start gap-2 via-[calc(100%-0.75rem)] to-transparent px-4 max-lg:bg-linear-to-b max-lg:pb-3 lg:gap-3">
                    {stageViews.map(stageView => (
                      <BoardColumnHeader
                        key={stageView.stage.id}
                        phaseKind={stageView.phaseKind}
                        stage={stageView.stage.id}
                        label={stageView.stage.label}
                        taskCount={stageView.taskCount}
                        totalTaskCount={totalTaskCount}
                        loading={stageView.loading}
                        collapsed={stageView.collapsed}
                        headerAction={stageView.createButton}
                      />
                    ))}
                  </div>
                )}
              </div>
              <BoardTooltipDelay>
                {layout === 'board' ? (
                  <div
                    role="group"
                    aria-label="Board columns"
                    className="flex flex-1 items-stretch gap-2 px-4 pb-4 lg:gap-3"
                  >
                    {stageViews.map(stageView => (
                      <BoardColumn
                        key={stageView.stage.id}
                        stage={stageView.stage.id}
                        label={stageView.stage.label}
                        collapsed={stageView.collapsed}
                        onDrop={onDrop}
                      >
                        {stageView.cards}
                      </BoardColumn>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col px-4 pb-4">
                    <BoardList>
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
                          action={stageView.createButton}
                          onDrop={onDrop}
                        >
                          {stageView.cards}
                        </BoardListGroup>
                      ))}
                    </BoardList>
                  </div>
                )}
              </BoardTooltipDelay>
            </div>
          </div>
        </BoardDetailsDock>
      </BoardOpenCardContext>
    </BoardScrollContext>
  );
}
