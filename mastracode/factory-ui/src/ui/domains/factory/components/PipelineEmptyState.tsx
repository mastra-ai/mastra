import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { useMaybeSidebarState } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import { AXIS, band, WIDTH } from '../funnelGeometry';
import { BOARD_STAGES } from '../stages';
import { BoardStageIcon } from './BoardIcons';

const STAGES = BOARD_STAGES.filter(stage => stage.id !== 'canceled');
// An outline of the chart's shape, not sample throughput. It has no values or readouts.
const PREVIEW_PATH = band([60, 58, 52, 44, 38, 34]);
const PREVIEW_HEIGHT = AXIS * 2;

export function PipelineEmptyState({
  hasWorkItems,
  rangeDays,
  factoryProjectId,
}: {
  hasWorkItems: boolean;
  rangeDays: number;
  factoryProjectId: string | undefined;
}) {
  const down = useMaybeSidebarState()?.isMobile ?? false;
  return (
    <div className={down ? 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4' : 'flex flex-col gap-4'}>
      <div aria-hidden className={down ? 'grid grid-rows-6' : 'grid grid-cols-6'}>
        {STAGES.map(stage => (
          <div key={stage.id} className="flex min-w-0 flex-col justify-center gap-1">
            <span className="flex items-center gap-1.5 grayscale">
              <BoardStageIcon stage={stage.id} />
              <Txt as="span" variant="meta" tone="muted" className="truncate">
                {stage.id === 'intake' ? 'Entered' : stage.label}
              </Txt>
            </span>
            <Txt as="span" variant="subheading" tone="faint">
              —
            </Txt>
          </div>
        ))}
      </div>
      <div className={down ? 'relative grid min-h-80 place-items-center' : 'relative grid min-h-52 place-items-center'}>
        <svg
          aria-hidden="true"
          viewBox={down ? `0 0 ${PREVIEW_HEIGHT} ${WIDTH}` : `0 0 ${WIDTH} ${PREVIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <path
            d={PREVIEW_PATH}
            transform={down ? 'matrix(0 1 1 0 0 0)' : undefined}
            fill="var(--fill-subtle)"
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="relative">
          <EmptyState
            as="h4"
            iconSlot={null}
            titleSlot={hasWorkItems ? `No new work in the last ${rangeDays} days` : 'Your pipeline starts here'}
            descriptionSlot={hasWorkItems ? 'Try a wider range, or start work on the board.' : undefined}
            actionSlot={
              factoryProjectId ? (
                <Button size="sm" render={<Link to={`/factories/${factoryProjectId}/work`} />}>
                  Open board
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
