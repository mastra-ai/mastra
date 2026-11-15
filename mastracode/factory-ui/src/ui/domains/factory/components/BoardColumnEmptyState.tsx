import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { BoardLayout } from '../boardLayout';
import { stageLabel } from '../stages';
import type { BoardStageId } from '../stages';

/** What the initial phase is missing before cards can arrive: a connected source, or a route to this board. */
export type IntakeSetup = 'source' | 'route';

interface BoardColumnEmptyCopy {
  title: string;
  description: string;
}

function boardColumnEmptyCopy(
  stage: BoardStageId,
  intakeSetup: IntakeSetup | undefined,
  isInitialPhase: boolean,
): BoardColumnEmptyCopy {
  if (isInitialPhase) {
    if (intakeSetup === 'source') {
      return {
        title: 'No intake sources',
        description: 'Create a card or connect an issue source in Work Intake settings.',
      };
    }
    if (intakeSetup === 'route') {
      return {
        title: 'No intake route sends cards here',
        description: 'Your connected sources file onto other boards. Create a card or add an intake route.',
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
      return {
        title: 'Nothing awaiting review',
        description: 'Drag built work here when it is ready for review.',
      };
    case 'pr-review':
      return {
        title: 'No pull requests in review',
        description: 'Press Review on a pull request card in Intake to start a review.',
      };
    case 'done':
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
  intakeSetup: IntakeSetup | undefined,
  filtersExcludeAll: boolean,
  isInitialPhase: boolean,
): BoardColumnEmptyCopy {
  if (filtersExcludeAll) {
    return {
      title: 'No work items match filters',
      description: 'Try adjusting or clearing your filters.',
    };
  }
  return boardColumnEmptyCopy(stage, intakeSetup, isInitialPhase);
}

export function BoardColumnEmptyState({
  stage,
  isInitialPhase,
  intakeSetup,
  filtersExcludeAll = false,
  layout,
  actionSlot,
}: {
  stage: BoardStageId;
  isInitialPhase: boolean;
  intakeSetup?: IntakeSetup;
  filtersExcludeAll?: boolean;
  layout: BoardLayout;
  actionSlot?: ReactNode;
}) {
  const copy = boardEmptyCopy(stage, intakeSetup, filtersExcludeAll, isInitialPhase);
  if (layout === 'list') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <Txt as="p" variant="meta" tone="muted" className="m-0">
          <Metadata>
            <Metadata.Item>{copy.title}</Metadata.Item>
            <Metadata.Item>
              <Txt as="span" variant="meta" tone="faint">
                {copy.description}
              </Txt>
            </Metadata.Item>
          </Metadata>
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
