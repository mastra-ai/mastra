import { groupConsecutive } from '@mastra/playground-ui/components/ai/tool-call';

import type { ReasoningView, StretchView, ToolView } from './activity-header';

/** What an open stretch lists: each thought as it was written, and the calls made between two thoughts. */
export type StretchSegment = ReasoningView | ToolView | { kind: 'calls'; key: string; tools: ToolView[] };

/** Calls in a row fold into one group; a call standing alone between thoughts stays a row of its own. */
export function stretchSegments(members: readonly StretchView[]): StretchSegment[] {
  const calls = groupConsecutive<StretchView, ToolView>(members, {
    key: member => member.key,
    joins: (member): member is ToolView => member.kind === 'tool',
    min: 2,
  });
  return members.flatMap((member): StretchSegment[] => {
    const tools = calls.byFirstKey.get(member.key);
    if (tools) return [{ kind: 'calls', key: member.key, tools }];
    return calls.memberKeys.has(member.key) ? [] : [member];
  });
}
