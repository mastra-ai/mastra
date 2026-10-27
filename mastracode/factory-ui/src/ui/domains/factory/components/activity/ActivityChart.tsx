import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';

import type { RunsState } from '../../hooks/useFactoryActivity';
import { ACTIVITY_KIND_ORDER } from '../../periodActivity';
import type { Activity, ActivityCounts } from '../../periodActivity';
import { countsLabel, slotWhen } from './activityFormat';
import { ActivityField } from './ActivityField';
import { ActivitySlotCard } from './ActivitySlotCard';

interface HoveredSlot {
  index: number;
  x: number;
  width: number;
}

function chartLabel({ slots, hoursPerSlot }: Activity, runs: RunsState) {
  const byWhen = new Map<string, ActivityCounts>();
  for (const slot of slots) {
    const { day, hours } = slotWhen(slot, hoursPerSlot);
    const when = hoursPerSlot === 1 && hours ? hours : day;
    const counts = byWhen.get(when) ?? { shipped: 0, ran: 0, cameIn: 0 };
    for (const kind of ACTIVITY_KIND_ORDER) counts[kind] += slot.counts[kind];
    byWhen.set(when, counts);
  }
  return [...byWhen].map(([when, counts]) => `${when}: ${countsLabel(counts, runs)}`).join('; ');
}

export function ActivityChart({
  id,
  open,
  activity,
  runs,
}: {
  id: string;
  open: boolean;
  activity: Activity;
  runs: RunsState;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredSlot>();
  const hoveredSlot = hovered && activity.slots[hovered.index];
  const hover = (index: number, clientX: number) => {
    const box = frame.current?.getBoundingClientRect();
    if (box) setHovered({ index, x: clientX - box.left, width: box.width });
  };
  return (
    <div
      ref={frame}
      className={cn(
        'duration-slow ease-out-custom relative grid transition-[grid-template-rows] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div
        id={id}
        role="img"
        aria-label={chartLabel(activity, runs)}
        inert={!open}
        className={cn(
          'duration-slow ease-out-custom -mx-1.5 min-h-0 overflow-hidden transition-opacity motion-reduce:transition-none',
          !open && 'opacity-0',
        )}
      >
        <div className="px-1.5 pb-1.5">
          <div className="bg-card dark:bg-muted shadow-raised rounded-card p-3.5 sm:p-4">
            <ActivityField
              slots={activity.slots}
              loading={runs.status === 'pending'}
              hovered={hovered?.index}
              onHover={hover}
              onLeave={() => setHovered(undefined)}
            />
          </div>
        </div>
      </div>
      {open && hovered && hoveredSlot && (
        <ActivitySlotCard
          slot={hoveredSlot}
          hoursPerSlot={activity.hoursPerSlot}
          runs={runs.status}
          x={hovered.x}
          containerWidth={hovered.width}
        />
      )}
    </div>
  );
}
