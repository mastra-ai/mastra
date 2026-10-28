import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';

import type { ActivityView } from '../activity-view';
import type { StretchSegment } from '../stretch-segments';
import { CallsGroup } from './CallsGroup';
import { ReasoningBody, reasoningHasBody } from './ReasoningBody';
import { ToolRow } from './ToolRow';

/** A thought reads as prose; calls made between two thoughts fold into a group; a lone call is its own row. */
export function SegmentRow({ segment, view, live }: { segment: StretchSegment; view: ActivityView; live: boolean }) {
  if (segment.kind === 'reasoning') {
    const content = getReasoningContent(segment.part);
    if (!content || !reasoningHasBody(content)) return null;
    return (
      <div data-activity-key={segment.key} className="py-1.5">
        <ReasoningBody content={content} />
      </div>
    );
  }
  if (segment.kind === 'calls') {
    return (
      <div data-activity-key={segment.key}>
        <CallsGroup tools={segment.tools} live={live} />
      </div>
    );
  }
  return (
    <div data-activity-key={segment.key}>
      <ToolRow member={segment} view={view} />
    </div>
  );
}
