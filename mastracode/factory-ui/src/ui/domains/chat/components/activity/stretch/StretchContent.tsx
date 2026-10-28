import { ActivityContent } from '@mastra/playground-ui/components/ai/activity';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';

import { ToolBody } from '../../tool/ToolCard';
import type { ActivityView } from '../activity-view';
import type { StretchSegment } from '../stretch-segments';
import { rowStyle } from '../row-style';
import { CALLS_PANEL, CallsPanel } from './CallsPanel';
import { ReasoningBody } from './ReasoningBody';
import { SegmentRow } from './SegmentRow';

const TOOL_BODY = `${rowStyle.content} max-w-[40rem]`;
const FLAT = 'ml-0 gap-0 px-0 before:hidden';

/**
 * What an open stretch shows. Thoughts read like the answer, flush and full width, with no cap; calls alone
 * are one capped group; a single call opens straight to its body.
 */
export function StretchContent({
  segments,
  view,
  live,
}: {
  segments: StretchSegment[];
  view: ActivityView;
  live: boolean;
}) {
  const [only] = segments;
  if (!only) return null;

  if (segments.length > 1) {
    return (
      <ActivityContent className={FLAT}>
        {segments.map((segment, index) => (
          <SegmentRow key={segment.key} segment={segment} view={view} live={live && index === segments.length - 1} />
        ))}
      </ActivityContent>
    );
  }

  if (only.kind === 'calls') {
    return (
      <ActivityContent className={CALLS_PANEL}>
        <CallsPanel tools={only.tools} live={live} />
      </ActivityContent>
    );
  }

  if (only.kind === 'tool') {
    return (
      <ActivityContent className={TOOL_BODY}>
        <ToolBody tool={only.tool} command={presentTool(only.tool.toolName, only.tool.args).command} />
      </ActivityContent>
    );
  }

  const reasoning = getReasoningContent(only.part);
  if (!reasoning) return null;
  return (
    <ActivityContent className={FLAT}>
      <ReasoningBody content={reasoning} />
    </ActivityContent>
  );
}
