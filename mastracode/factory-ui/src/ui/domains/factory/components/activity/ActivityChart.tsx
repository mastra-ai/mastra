import { Txt } from '@mastra/playground-ui/components/Txt';
import { useRef, useState } from 'react';

import type { RunsState } from '../../hooks/useFactoryActivity';
import { ACTIVITY_KIND_ORDER, ACTIVITY_PERIOD_LABELS } from '../../periodActivity';
import type { Activity, ActivityCounts, ActivityPeriod } from '../../periodActivity';
import { countsLabel, slotWhen } from './activityFormat';
import { ActivityField, FIELD_HEIGHT } from './ActivityField';
import { ActivityReveal } from './ActivityReveal';
import { ActivitySlotCard } from './ActivitySlotCard';

interface HoveredSlot {
  index: number;
  x: number;
  width: number;
}

function chartLabel({ slots, hoursPerSlot }: Activity, status: RunsState['status']) {
  const byWhen = new Map<string, { counts: ActivityCounts; complete: boolean }>();
  for (const slot of slots) {
    const { day, hours } = slotWhen(slot, hoursPerSlot);
    const when = hoursPerSlot === 1 && hours ? hours : day;
    const group = byWhen.get(when) ?? { counts: { cameIn: 0, ran: 0, shipped: 0 }, complete: true };
    for (const kind of ACTIVITY_KIND_ORDER) group.counts[kind] += slot.counts[kind];
    group.complete = group.complete && slot.ranComplete;
    byWhen.set(when, group);
  }
  return [...byWhen]
    .map(([when, { counts, complete }]) => `${when}: ${countsLabel(counts, { status, complete })}`)
    .join('; ');
}

export function ActivityChart({
  id,
  open,
  period,
  activity,
  runs,
}: {
  id: string;
  open: boolean;
  period: ActivityPeriod;
  activity: Activity;
  runs: RunsState;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredSlot>();
  const hoveredSlot = hovered && activity.slots[hovered.index];
  const quiet = runs.status === 'success' && ACTIVITY_KIND_ORDER.every(kind => activity.totals[kind] === 0);
  const hover = (index: number, clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (box) setHovered({ index, x: clientX - box.left, width: box.width });
  };
  return (
    <div ref={frame} className="relative">
      <ActivityReveal id={id} open={open} className="-mx-1.5">
        <div className="px-1.5 pb-1.5">
          <div className="bg-card dark:bg-muted shadow-raised rounded-card p-3.5 sm:p-4">
            {quiet ? (
              <div className="flex items-center justify-center" style={{ height: FIELD_HEIGHT }}>
                <Txt as="p" variant="body-sm" tone="muted" className="m-0">
                  Nothing came in, ran or shipped {ACTIVITY_PERIOD_LABELS[period].toLowerCase()}.
                </Txt>
              </div>
            ) : (
              <div role="img" aria-label={chartLabel(activity, runs.status)}>
                <ActivityField
                  slots={activity.slots}
                  loading={runs.status === 'pending'}
                  hovered={hovered?.index}
                  onHover={hover}
                  onLeave={() => setHovered(undefined)}
                />
              </div>
            )}
          </div>
        </div>
      </ActivityReveal>
      {open && hovered && hoveredSlot && (
        <ActivitySlotCard
          slot={hoveredSlot}
          hoursPerSlot={activity.hoursPerSlot}
          runs={{ status: runs.status, complete: hoveredSlot.ranComplete }}
          x={hovered.x}
          containerWidth={hovered.width}
        />
      )}
    </div>
  );
}
