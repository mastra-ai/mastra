import { useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { ActivityChart } from './activity-chart';
import { countsLabel } from './activity-format';
import { ACTIVITY_PERIOD_LABELS, traySurface } from './activity-model';
import type { Activity, ActivityPeriod, RunsState } from './activity-model';
import { ActivityPeriodMenu } from './activity-period-menu';
import { ActivityReveal } from './activity-reveal';
import { ActivityTotals } from './activity-totals';
import { Metadata } from '@/ds/components/Metadata';
import { Txt } from '@/ds/components/Txt';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';
import { IconScript } from '@/ds/icons/central/IconScript';
import { textStyle } from '@/ds/primitives/text';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

export type RecapButtonProps = Omit<ComponentProps<'button'>, 'type' | 'className' | 'children'> & { label: string };

export function RecapButton({ label, ...props }: RecapButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        textStyle({ variant: 'caption', tone: 'muted' }),
        'flex shrink-0 cursor-pointer items-center gap-1 rounded-sm transition-colors duration-fast ease-out-custom hover:text-foreground motion-reduce:transition-none',
        focusRing,
      )}
    >
      <IconScript aria-hidden className="size-icon-sm" />
      {label}
    </button>
  );
}

export interface LiveCount {
  count: number;
  label: string;
}

function LiveSessions({ parts }: { parts: readonly LiveCount[] }) {
  const shown = parts.filter(({ count }) => count > 0);
  if (shown.length === 0) return null;
  return (
    <Txt as="p" variant="caption" tone="muted" className="m-0 tabular-nums">
      <Metadata>
        {shown.map(({ count, label }) => (
          <Metadata.Item key={label}>
            <span className="text-foreground">{count.toLocaleString()}</span> {label.toLowerCase()}
          </Metadata.Item>
        ))}
      </Metadata>
    </Txt>
  );
}

export interface ActivityBandProps {
  period: ActivityPeriod;
  onPeriodChange: (period: ActivityPeriod) => void;
  activity: Activity;
  runs: RunsState;
  /** Live session counts shown beside the totals; zero counts are left out. */
  live: readonly LiveCount[];
  /** Shown once something shipped in the period, e.g. a `RecapButton`. */
  recap?: ReactNode;
}

export function ActivityBand({ period, onPeriodChange, activity, runs, live, recap }: ActivityBandProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const chartId = useId();
  const periodId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {ACTIVITY_PERIOD_LABELS[period]}
      </h2>
      <div className={cn(traySurface, 'px-1.5 pt-1.5')}>
        <div className="group/band relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 pt-2 pb-3.5 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${chartId} ${periodId}`}
              aria-label={countsLabel(activity.totals, runs)}
              onClick={() => setOpen(was => !was)}
              className="flex cursor-pointer items-center after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-border-focus focus-visible:after:outline-solid"
            >
              <ActivityTotals totals={activity.totals} runs={runs} swatches={open} />
            </button>
            <LiveSessions parts={live} />
          </div>
          <div className="flex items-center gap-4">
            {activity.totals.shipped > 0 && recap && <div className="relative z-10">{recap}</div>}
            <IconChevronDownMedium
              aria-hidden
              className={cn(
                'size-icon-sm text-muted-foreground transition-[rotate,color] duration-slow ease-out-custom group-has-[[aria-controls]:hover]/band:text-foreground motion-reduce:transition-none',
                open && 'rotate-180',
              )}
            />
          </div>
        </div>
        <ActivityChart id={chartId} open={open} period={period} activity={activity} runs={runs} />
      </div>
      <ActivityReveal id={periodId} open={open} className="flex justify-end px-5 pt-2.5 pb-1 sm:px-5.5">
        <ActivityPeriodMenu period={period} onPeriodChange={onPeriodChange} />
      </ActivityReveal>
    </section>
  );
}
