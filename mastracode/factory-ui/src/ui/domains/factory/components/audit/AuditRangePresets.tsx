import { cn } from '@mastra/playground-ui/utils/cn';

import type { AuditTimeRange } from '../../auditPresentation';
import { FilterChip } from './FilterChip';

const HOUR = 3_600_000;
const PRESETS = [
  { label: '1h', duration: HOUR },
  { label: '6h', duration: 6 * HOUR },
  { label: '24h', duration: 24 * HOUR },
  { label: '7d', duration: 7 * 24 * HOUR },
];

export function AuditRangePresets({
  bounds,
  range,
  onRangeChange,
  className,
}: {
  bounds: AuditTimeRange;
  range: AuditTimeRange | undefined;
  onRangeChange: (range: AuditTimeRange | undefined) => void;
  className?: string;
}) {
  const available = PRESETS.filter(preset => preset.duration < bounds.to - bounds.from);
  if (available.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap justify-center gap-1', className)} role="group" aria-label="Audit time range">
      <FilterChip label="All" pressed={range === undefined} onClick={() => onRangeChange(undefined)} />
      {available.map(preset => {
        const from = bounds.to - preset.duration;
        return (
          <FilterChip
            key={preset.label}
            label={preset.label}
            pressed={range?.from === from && range.to === bounds.to}
            onClick={() => onRangeChange({ from, to: bounds.to })}
          />
        );
      })}
    </div>
  );
}
