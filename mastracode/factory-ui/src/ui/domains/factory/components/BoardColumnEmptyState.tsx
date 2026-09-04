import { Txt } from '@mastra/playground-ui/components/Txt';

import type { BoardKind } from '../boardStages';
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
          description: 'Choose GitHub or Linear in Settings to feed this column.',
        };
      }
      return kind === 'review'
        ? {
            title: 'No pull requests waiting',
            description: 'Open pull requests from this repository appear here.',
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
            description: 'Drag a pull request here when review starts.',
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
  }
}

export function BoardColumnEmptyState({
  stage,
  kind,
  hasIntakeSource,
  filtersExcludeAll = false,
}: {
  stage: BoardStageId;
  kind: BoardKind;
  hasIntakeSource: boolean;
  filtersExcludeAll?: boolean;
}) {
  const copy = filtersExcludeAll
    ? {
        title: kind === 'review' ? 'No pull requests match filters' : 'No work items match filters',
        description: 'Try another teammate or relevance type.',
      }
    : boardColumnEmptyCopy(stage, kind, hasIntakeSource);
  return (
    <div className="border-border1 flex min-h-24 flex-col justify-center rounded-3xl border border-dashed px-4 py-4">
      <Txt as="p" variant="ui-sm" className="text-icon4 m-0 font-medium">
        {copy.title}
      </Txt>
      <Txt as="p" variant="ui-xs" className="text-icon3 mt-1 mb-0 max-w-60 leading-5">
        {copy.description}
      </Txt>
    </div>
  );
}
