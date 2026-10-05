import type { ReactNode } from 'react';
import type { BoardPhaseKind } from '@mastra/factory/boards';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { BoardLayout } from '../../domains/factory/boardLayout';
import type { DragPayload } from '../../domains/factory/boardDrag';
import { BoardColumn, BoardColumnHeader } from '../../domains/factory/components/BoardColumn';
import { BoardList, BoardListGroup } from '../../domains/factory/components/BoardList';
import { BoardTooltipDelay } from '../../domains/factory/components/BoardCardParts';

export interface BoardStageView {
  stage: { id: string; label: string };
  phaseKind?: BoardPhaseKind;
  taskCount: number;
  loading: boolean;
  collapsed: boolean;
  createButton?: ReactNode;
  intakeSwitch?: ReactNode;
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
  return (
    <div className="[container-type:inline-size] m-px min-h-0 flex-1 overflow-auto overscroll-x-contain rounded-[calc(var(--studio-frame-radius,1.5rem)-1px)] [scrollbar-gutter:stable] lg:overscroll-x-auto">
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
                  headerExtras={stageView.intakeSwitch}
                />
              ))}
            </div>
          )}
        </div>
        <BoardTooltipDelay>
          {layout === 'board' ? (
            <div role="group" aria-label="Board columns" className="flex flex-1 items-stretch gap-2 px-4 pb-4 lg:gap-3">
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
                    action={stageView.createButton}
                    extras={stageView.intakeSwitch}
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
  );
}
