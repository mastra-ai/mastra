import type { ActivitySegment } from '../model/activity-segments';
import { CallsPanel } from './calls-panel';
import { StretchSegment } from './stretch-segment';
import { StretchThought } from './stretch-thought';
import { ActivityContent } from '@/ds/components/ai/activity';

/**
 * What an open stretch shows. Thoughts read like the answer, flush and full width; calls alone are one capped
 * list; a single call opens straight to its body.
 */
export function StretchContent({ segments, live }: { segments: readonly ActivitySegment[]; live: boolean }) {
  if (segments.length > 1) {
    return (
      <ActivityContent flush>
        {segments.map((segment, index) => (
          <StretchSegment key={segment.key} segment={segment} live={live && index === segments.length - 1} />
        ))}
      </ActivityContent>
    );
  }

  const [only] = segments;
  if (!only) return null;
  if (only.kind === 'calls') return <CallsPanel calls={only.calls} live={live} />;
  if (only.kind === 'call') return <ActivityContent className="max-w-[40rem]">{only.body}</ActivityContent>;
  return (
    <ActivityContent flush>
      <StretchThought content={only.content} />
    </ActivityContent>
  );
}
