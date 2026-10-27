import { Txt } from '@mastra/playground-ui/components/Txt';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronDown, ScrollText, SquareKanban } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { traySurface } from '../../../../ui/tray';
import { usePromptButton } from '../../../chat/hooks/usePromptButton';
import { SESSION_STATUS_LABELS } from '../../../workspaces/services/sessionRows';
import { useFactoryActivity } from '../../hooks/useFactoryActivity';
import { PERIOD_DAYS } from '../../periodActivity';
import type { ActivityPeriod } from '../../periodActivity';
import { rememberedBoardPath } from '../../services/boardViews';
import { countsLabel } from './activityFormat';
import { ActivityChart } from './ActivityChart';
import { ActivityPeriodMenu } from './ActivityPeriodMenu';
import { ActivityTotals } from './ActivityTotals';

const RECAPS: Record<ActivityPeriod, { label: string; since: string }> = {
  today: { label: 'Recap today', since: 'today' },
  week: { label: 'Recap the week', since: `in the last ${PERIOD_DAYS.week} days` },
  month: { label: 'Recap the month', since: `in the last ${PERIOD_DAYS.month} days` },
};

const bandAction = cn(
  textStyle({ variant: 'caption', tone: 'muted' }),
  'hover:text-foreground duration-fast ease-out-custom flex shrink-0 cursor-pointer items-center gap-1 rounded-sm transition-colors motion-reduce:transition-none',
  focusRing,
);

function RecapButton({ period }: { period: ActivityPeriod }) {
  const { label, since } = RECAPS[period];
  const promptButton = usePromptButton(
    `Summarize what reached Done ${since}. Group it by theme and call out anything still waiting on someone.`,
  );
  return (
    <button type="button" {...promptButton} className={bandAction}>
      <ScrollText aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}

function LiveSessions({ working, waiting }: { working: number; waiting: number }) {
  const parts = [
    { count: working, label: SESSION_STATUS_LABELS.working },
    { count: waiting, label: SESSION_STATUS_LABELS.waiting },
  ].filter(({ count }) => count > 0);
  if (parts.length === 0) return null;
  return (
    <Txt as="p" variant="caption" tone="muted" className="m-0 tabular-nums">
      {parts.map(({ count, label }, index) => (
        <span key={label}>
          {index > 0 && ' · '}
          <span className="text-foreground">{count.toLocaleString()}</span> {label.toLowerCase()}
        </span>
      ))}
    </Txt>
  );
}

export function FactoryActivity({ factoryId }: { factoryId: string }) {
  const [period, setPeriod] = useState<ActivityPeriod>('week');
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const chartId = useId();
  const { hasCards, activity, runs, live } = useFactoryActivity(factoryId, period);
  if (!hasCards) return null;
  return (
    <section aria-labelledby={headingId} className={cn(traySurface, 'px-1.5 pt-1.5')}>
      <div className="group/band relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 pt-2 pb-3.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <h2 id={headingId} className="relative z-10 m-0">
            <ActivityPeriodMenu period={period} onPeriodChange={setPeriod} />
          </h2>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={chartId}
            aria-label={countsLabel(activity.totals, runs)}
            onClick={() => setOpen(was => !was)}
            className="focus-visible:after:outline-border-focus after:rounded-card flex cursor-pointer items-center after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-solid"
          >
            <span className="relative z-10">
              <ActivityTotals totals={activity.totals} runs={runs} swatches={open} />
            </span>
          </button>
          <LiveSessions working={live.working} waiting={live.waiting} />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative z-10 flex shrink-0 items-center gap-4">
            {activity.totals.shipped > 0 && <RecapButton period={period} />}
            <Link to={rememberedBoardPath(factoryId, 'work')} className={bandAction}>
              <SquareKanban aria-hidden className="size-3.5" />
              All work
            </Link>
          </div>
          <ChevronDown
            aria-hidden
            className={cn(
              'text-muted-foreground duration-slow ease-out-custom size-3.5 transition-[rotate,color] group-has-[[aria-controls]:hover]/band:text-foreground motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </div>
      </div>
      <ActivityChart key={period} id={chartId} open={open} activity={activity} runs={runs} />
    </section>
  );
}
