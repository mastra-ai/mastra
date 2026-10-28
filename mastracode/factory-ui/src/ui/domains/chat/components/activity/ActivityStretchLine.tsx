import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';

import { toolHasBody } from '../tool/ToolCard';
import { toolFromInvocationPart } from '../transcript-parts';
import type { MessagePart } from '../transcript-parts';
import { stretchHeader } from './activity-header';
import type { StretchView } from './activity-header';
import { reasoningWithState } from './activity-plan';
import type { ActivityStretch } from './activity-plan';
import { callsViewKeys, useActivityView, useActivityViewStore } from './activity-view';
import { ActivityFold } from './stretch/ActivityFold';
import { reasoningHasBody } from './stretch/ReasoningBody';
import { StretchContent } from './stretch/StretchContent';
import { stretchSegments } from './stretch-segments';

function memberHasBody(member: StretchView): boolean {
  if (member.kind === 'tool') {
    return toolHasBody(member.tool, presentTool(member.tool.toolName, member.tool.args).command);
  }
  const reasoning = getReasoningContent(member.part);
  return reasoning !== undefined && reasoningHasBody(reasoning);
}

/**
 * One collapsed line for a stretch of tool work. Members in the hosting entry show only once
 * revealed, so streaming reasoning keeps its pacing; members from later entries are already settled.
 */
export function ActivityStretchLine({
  stretch,
  hostEntryId,
  revealed,
}: {
  stretch: ActivityStretch;
  hostEntryId: string;
  revealed: ReadonlyMap<string, MessagePart>;
}) {
  const visible = stretch.members.flatMap((member): StretchView[] => {
    const part = member.entryId === hostEntryId ? revealed.get(member.key) : member.part;
    if (member.kind === 'tool' && part?.type === 'tool-invocation') {
      return [
        { kind: 'tool', key: member.key, tool: toolFromInvocationPart(part, member.runtime, member.messageCreatedAt) },
      ];
    }
    if (member.kind === 'reasoning' && part?.type === 'reasoning') {
      return [{ kind: 'reasoning', key: member.key, part: reasoningWithState(part, member.entryStreaming) }];
    }
    return [];
  });
  const memberKeys = stretch.members.map(member => member.key);
  const store = useActivityViewStore();
  const view = useActivityView(memberKeys);

  const [single] = visible;
  if (!single) return null;
  const segments = stretchSegments(visible);
  const [onlySegment] = segments;
  const soleCalls = segments.length === 1 && onlySegment?.kind === 'calls' ? onlySegment.tools : undefined;

  function rememberOpen(open: boolean) {
    store.link(view, memberKeys);
    if (soleCalls) store.claim(callsViewKeys(soleCalls)).open = open;
  }

  return (
    <ActivityFold
      slot="activity-stretch"
      header={stretchHeader(visible, stretch.live, stretch.elapsedMs)}
      view={view}
      foldable={visible.length > 1 || memberHasBody(single)}
      prominent
      onOpenChange={rememberOpen}
    >
      <StretchContent segments={segments} view={view} live={stretch.live} />
    </ActivityFold>
  );
}
