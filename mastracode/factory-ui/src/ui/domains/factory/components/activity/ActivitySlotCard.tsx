import { Txt } from '@mastra/playground-ui/components/Txt';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { RunsState } from '../../hooks/useFactoryActivity';
import type { ActivitySlot } from '../../periodActivity';
import { ACTIVITY_KINDS, slotWhen, totalOf } from './activityFormat';

const WIDTH_PX = 288;

export function ActivitySlotCard({
  slot,
  hoursPerSlot,
  runs,
  x,
  containerWidth,
}: {
  slot: ActivitySlot;
  hoursPerSlot: number;
  runs: RunsState;
  x: number;
  containerWidth: number;
}) {
  const { day, hours } = slotWhen(slot, hoursPerSlot);
  const half = WIDTH_PX / 2;
  return (
    <div
      aria-hidden
      className={cn(
        overlaySurfaceStyle,
        'rounded-card duration-fast ease-out-custom pointer-events-none absolute -top-2 z-20 flex -translate-x-1/2 -translate-y-full flex-col gap-2 p-2 transition-[left] motion-reduce:transition-none',
      )}
      style={{ width: WIDTH_PX, left: Math.min(Math.max(x, half), containerWidth - half) }}
    >
      <div className="flex items-baseline justify-between gap-3 px-1.5 pt-1 whitespace-nowrap">
        <Txt as="span" variant="body-sm" tone="ink">
          {day}
        </Txt>
        {hours && (
          <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
            {hours}
          </Txt>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {ACTIVITY_KINDS.map(({ kind, label, icon: Icon }) => {
          const active = slot.counts[kind] > 0;
          return (
            <div
              key={kind}
              className={cn(
                'flex flex-col gap-3 rounded-[calc(var(--radius-card)-var(--spacing)*2)] p-2.5',
                active ? 'bg-fill' : 'bg-fill-subtle',
              )}
            >
              <Icon className={cn('size-4', active ? 'text-foreground' : 'text-muted-foreground')} />
              <div className="flex flex-col gap-0.5">
                {kind === 'ran' && runs.status === 'pending' ? (
                  <span className="bg-fill h-7 w-8 rounded-md motion-safe:animate-pulse" />
                ) : (
                  <Txt
                    as="span"
                    variant="title"
                    font="display"
                    tone={active ? 'ink' : 'faint'}
                    className="leading-none tabular-nums"
                  >
                    {totalOf(kind, slot.counts, runs).count}
                  </Txt>
                )}
                <Txt as="span" variant="caption" tone="muted" className="truncate">
                  {label}
                </Txt>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
