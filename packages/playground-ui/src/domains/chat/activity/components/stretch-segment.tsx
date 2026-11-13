import type { ActivitySegment } from '../model/activity-segments';
import { CallsGroup } from './calls-group';
import { StretchThought } from './stretch-thought';

/** A thought reads as prose; calls made between two thoughts fold into a group; a lone call is its own row. */
export function StretchSegment({ segment, live }: { segment: ActivitySegment; live: boolean }) {
  if (segment.kind === 'thought') {
    return (
      <div className="py-1.5">
        <StretchThought content={segment.content} />
      </div>
    );
  }
  if (segment.kind === 'calls') return <CallsGroup calls={segment.calls} live={live} />;
  return segment.row;
}
