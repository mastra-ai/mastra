import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { BoardLayout } from '../boardLayout';
import type { BoardKind } from '../boardStages';
import { stageLabel } from '../stages';
import type { BoardStageId } from '../stages';

interface BoardColumnEmptyCopy {
  title: string;
  description: string;
}

function boardColumnEmptyCopy(
  stage: BoardStageId,
  kind: BoardKind,
  hasIntakeSource: boolean,
  isInitialPhase: boolean,
): BoardColumnEmptyCopy {
  if (isInitialPhase) {
    if (kind === 'review') {
      return {
        title: 'No change requests waiting',
        description: 'Open change requests from connected repositories appear here.',
      };
    }
    if (!hasIntakeSource) {
      return {
        title: 'No intake sources',
        description: 'Create a card or connect an issue source in Work Intake settings.',
      };
    }
    return {
      title: 'Intake is clear',
      description: 'New issues from your connected sources appear here.',
    };
  }
  switch (stage) {
    case 'triage':
      return {
        title: 'Nothing to triage',
        description: 'Drag an intake item here when it needs investigation.',
      };
    case 'planning':
      return {
        title: 'Nothing in planning',
        description: 'Drag triaged work here when it is ready to plan.',
      };
    case 'execute':
      return {
        title: 'Nothing being built',
        description: 'Drag planned work here when implementation starts.',
      };
    case 'review':
      if (kind === 'review') {
        return {
          title: 'No active reviews',
          description: 'Drag a change request here when review starts.',
        };
      }
      return {
        title: 'Nothing awaiting review',
        description: 'Drag built work here when it is ready for review.',
      };
    case 'done':
      if (kind === 'review') {
        return {
          title: 'No completed reviews',
          description: 'Drag a reviewed pull request here when it is complete.',
        };
      }
      return {
        title: 'Nothing completed yet',
        description: 'Drag finished work here to close it out.',
      };
    case 'canceled':
      return {
        title: 'Nothing canceled',
        description: 'Drag work here when it should leave the active flow.',
      };
    default:
      return {
        title: `Nothing in ${stageLabel(stage)}`,
        description: 'Drag work here when it reaches this stage.',
      };
  }
}

function boardEmptyCopy(
  stage: BoardStageId,
  kind: BoardKind,
  hasIntakeSource: boolean,
  filtersExcludeAll: boolean,
  alreadyMaterialized: number,
  isInitialPhase: boolean,
): BoardColumnEmptyCopy {
  if (filtersExcludeAll) {
    return {
      title: kind === 'review' ? 'No change requests match filters' : 'No work items match filters',
      description: 'Try adjusting or clearing your filters.',
    };
  }
  const copy = boardColumnEmptyCopy(stage, kind, hasIntakeSource, isInitialPhase);
  if (alreadyMaterialized <= 0) return copy;
  const itemsLabel =
    alreadyMaterialized === 1 ? 'item from this source already has' : 'items from this source already have';
  return {
    title: copy.title,
    description: `${alreadyMaterialized} ${itemsLabel} a card on another board, so the feed only offers new ones.`,
  };
}

export function BoardColumnEmptyState({
  stage,
  isInitialPhase,
  kind,
  hasIntakeSource,
  filtersExcludeAll = false,
  alreadyMaterialized = 0,
  layout,
  actionSlot,
}: {
  stage: BoardStageId;
  isInitialPhase: boolean;
  kind: BoardKind;
  hasIntakeSource: boolean;
  filtersExcludeAll?: boolean;
  /** Feed items withheld because their card sits on another board in this Factory. */
  alreadyMaterialized?: number;
  layout: BoardLayout;
  actionSlot?: ReactNode;
}) {
  const copy = boardEmptyCopy(stage, kind, hasIntakeSource, filtersExcludeAll, alreadyMaterialized, isInitialPhase);
  if (layout === 'list') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Txt as="p" variant="meta" tone="muted" className="m-0">
          {copy.title}
          <Txt as="span" variant="meta" tone="faint">{` · ${copy.description}`}</Txt>
        </Txt>
        {actionSlot && <div className="flex flex-wrap gap-2">{actionSlot}</div>}
      </div>
    );
  }
  return (
    <div className="border-border rounded-card flex min-h-24 flex-col justify-center border border-dashed px-4 py-4">
      <Txt tone="muted" as="p" variant="column" className="m-0">
        {copy.title}
      </Txt>
      <Txt tone="muted" as="p" variant="meta" className="mt-1 mb-0 max-w-60">
        {copy.description}
      </Txt>
      {actionSlot && <div className="mt-3 flex flex-wrap gap-2">{actionSlot}</div>}
    </div>
  );
}
