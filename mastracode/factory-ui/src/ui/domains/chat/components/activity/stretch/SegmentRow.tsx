import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';

import type { ActivityView } from '../activity-view';
import type { StretchSegment } from '../stretch-segments';
import { CallsGroup } from './CallsGroup';
import { ReasoningBody } from './ReasoningBody';
import { ToolRow } from './ToolRow';

/** A thought reads as prose; calls made between two thoughts fold into a group; a lone call is its own row. */
export function SegmentRow({ segment, view, live }: { segment: StretchSegment; view: ActivityView; live: boolean }) {
  if (segment.kind === 'reasoning') {
    const content = getReasoningContent(segment.part);
    if (!content) return null;
    return (
      <div className="py-1.5">
        <ReasoningBody content={content} />
      </div>
    );
  }
  if (segment.kind === 'calls') return <CallsGroup tools={segment.tools} view={view} live={live} />;
  return <ToolRow member={segment} view={view} />;
}
