import { Txt } from '@mastra/playground-ui/components/Txt';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SquareKanban } from 'lucide-react';
import { Link } from 'react-router';

import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { belongsToBoard, itemAppearsInStage } from '../boardStages';
import { rememberedBoardPath } from '../services/boardViews';
import { BOARD_STAGES, isTerminalStage } from '../stages';
import { stageIndicatorClass } from './BoardIcons';

// Saved cards only: the board's Intake column also lists live candidates that have no card yet.
const OPEN_STAGES = BOARD_STAGES.filter(({ id }) => !isTerminalStage(id));

export function InFlight({ factoryId }: { factoryId: string }) {
  const workItems = useWorkItemsQuery(factoryId);
  const cards = (workItems.data ?? []).filter(item => belongsToBoard(item, 'work'));
  const stages = OPEN_STAGES.map(({ id, label }) => ({
    stage: id,
    label,
    count: cards.filter(item => itemAppearsInStage(item, id, BOARD_STAGES)).length,
  }));
  const total = stages.reduce((sum, { count }) => sum + count, 0);
  if (total === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="in-flight-heading">
      <div className="flex items-center justify-between gap-3">
        <Txt as="h2" variant="subheading" tone="muted" id="in-flight-heading" className="m-0">
          In flight
        </Txt>
        <Link
          to={rememberedBoardPath(factoryId, 'work')}
          className={cn(
            textStyle({ variant: 'caption', tone: 'muted' }),
            'hover:text-foreground flex items-center gap-1 rounded-sm transition-colors',
            focusRing,
          )}
        >
          <SquareKanban aria-hidden className="size-3.5" />
          All work
        </Link>
      </div>
      <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full">
        {stages
          .filter(({ count }) => count > 0)
          .map(({ stage, count }) => (
            <span key={stage} className={stageIndicatorClass(stage)} style={{ width: `${(count / total) * 100}%` }} />
          ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
        {stages.map(({ stage, label, count }) => (
          <li key={stage} className={cn(textStyle({ variant: 'caption', tone: 'muted' }), 'flex items-center gap-1.5')}>
            <span aria-hidden className={cn('size-1.5 rounded-full', stageIndicatorClass(stage))} />
            {label} <span className="text-foreground tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
