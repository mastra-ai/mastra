import { EmptyState } from '@mastra/playground-ui/components/EmptyState';

import type { BoardKind } from '../boardStages';
import { stageLabel } from '../stages';
import type { BoardStageId } from '../stages';

interface BoardColumnEmptyCopy {
  title: string;
  description: string;
}

function boardColumnEmptyCopy(stage: BoardStageId, kind: BoardKind, hasIntakeSource: boolean): BoardColumnEmptyCopy {
  switch (stage) {
    case 'intake':
      if (!hasIntakeSource) {
        return {
          title: 'No intake sources',
          description: 'Choose GitHub, GitLab, Linear, or Jira in Settings to feed this column.',
        };
      }
      return kind === 'review'
        ? {
            title: 'No change requests waiting',
            description: 'Open change requests from connected repositories appear here.',
          }
        : {
            title: 'Intake is clear',
            description: 'New issues from your connected sources appear here.',
          };
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
      return kind === 'review'
        ? {
            title: 'No active reviews',
            description: 'Drag a change request here when review starts.',
          }
        : {
            title: 'Nothing awaiting review',
            description: 'Drag built work here when it is ready for review.',
          };
    case 'done':
      return kind === 'review'
        ? {
            title: 'No completed reviews',
            description: 'Drag a reviewed pull request here when it is complete.',
          }
        : {
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

export function BoardColumnEmptyState({
  stage,
  kind,
  hasIntakeSource,
  filtersExcludeAll = false,
  alreadyMaterialized = 0,
}: {
  stage: BoardStageId;
  kind: BoardKind;
  hasIntakeSource: boolean;
  filtersExcludeAll?: boolean;
  /** Feed items withheld because their card sits on another board in this Factory. */
  alreadyMaterialized?: number;
}) {
  const copy = filtersExcludeAll
    ? {
        title: kind === 'review' ? 'No change requests match filters' : 'No work items match filters',
        description: 'Try another teammate or relevance type.',
      }
    : alreadyMaterialized > 0
      ? {
          title: boardColumnEmptyCopy(stage, kind, hasIntakeSource).title,
          description: `${alreadyMaterialized} ${alreadyMaterialized === 1 ? 'item from this source already has' : 'items from this source already have'} a card on another board, so the feed only offers new ones.`,
        }
      : boardColumnEmptyCopy(stage, kind, hasIntakeSource);
  return (
    <EmptyState
      as="h3"
      iconSlot={null}
      className="border-border rounded-card min-h-24 border border-dashed px-4 py-4"
      titleSlot={copy.title}
      descriptionSlot={copy.description}
    />
  );
}
