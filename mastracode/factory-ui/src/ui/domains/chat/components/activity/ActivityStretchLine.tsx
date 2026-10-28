import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';

import { toolHasBody } from '../tool/ToolBody';
import { toolFromInvocationPart } from '../transcript-parts';
import type { MessagePart } from '../transcript-parts';
import { stretchHeader } from './activity-header';
import type { StretchView } from './activity-header';
import { reasoningWithState } from './activity-plan';
import type { ActivityStretch } from './activity-plan';
import { useActivityView, useActivityViewStore } from './activity-view';
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

  if (visible.length === 0) return null;
  const shown = visible.filter(member => member.kind === 'tool' || memberHasBody(member));

  function rememberOpen() {
    store.link(view, memberKeys);
  }

  return (
    <Arriving>
      <ActivityFold
        slot="activity-stretch"
        header={stretchHeader(visible, stretch.live, stretch.elapsedMs)}
        view={view}
        foldable={shown.length > 1 || shown.some(memberHasBody)}
        prominent
        onOpenChange={rememberOpen}
      >
        <StretchContent segments={stretchSegments(shown)} view={view} live={stretch.live} />
      </ActivityFold>
    </Arriving>
  );
}
