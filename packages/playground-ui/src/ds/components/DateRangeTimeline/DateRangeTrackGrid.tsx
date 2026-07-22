import type { DateRangeGridMarker } from './lib/date-range-timeline-grid';
import { cn } from '@/lib/utils';

interface DateRangeTrackGridProps {
  markers: DateRangeGridMarker[];
}

function getMarkerHeight(emphasis: DateRangeGridMarker['emphasis']) {
  if (emphasis === 'major') return 'h-5';
  if (emphasis === 'medium') return 'h-3';
  return 'h-1.5';
}

export function DateRangeTrackGrid({ markers }: DateRangeTrackGridProps) {
  // Skip markers sitting exactly on the edges — the track boundary already reads as a line there.
  const interiorMarkers = markers.filter(marker => marker.position > 0 && marker.position < 100);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {interiorMarkers.map(marker => (
        <span
          key={marker.index}
          className={cn('absolute top-1/2 w-px -translate-1/2 bg-neutral3/15', getMarkerHeight(marker.emphasis))}
          style={{ left: `${marker.position}%` }}
        />
      ))}
    </div>
  );
}
