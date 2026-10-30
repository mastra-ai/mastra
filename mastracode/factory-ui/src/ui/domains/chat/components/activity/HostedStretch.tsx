import { Arriving, Continuing } from '@mastra/playground-ui/components/Arrival';
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';
import { ActivityStretchLine } from '@mastra/playground-ui/domains/chat/activity';
import type { ActivityCallState, ActivityMember } from '@mastra/playground-ui/domains/chat/activity';
import { getReasoningContent } from '@mastra/playground-ui/domains/chat/messages/reasoning-content';
import { useState } from 'react';

import { ToolBody, toolHasBody } from '../tool/ToolBody';
import { reasoningWithState, toolFromInvocationPart } from '../transcript-parts';
import type { MessagePart } from '../transcript-parts';
import type { ActivityStretch, StretchMember } from './activity-plan';
import { StretchToolRow } from './StretchToolRow';

type HostedPart = MessagePart | StretchMember['part'];

function activityMember(member: StretchMember, part: HostedPart | undefined): ActivityMember | undefined {
  if (member.kind === 'tool' && part?.type === 'tool-invocation') {
    const tool = toolFromInvocationPart(part, member.runtime, member.messageCreatedAt);
    const { command } = presentTool(tool.toolName, tool.args);
    return {
      kind: 'call',
      key: member.key,
      toolName: tool.toolName,
      args: tool.args,
      status: tool.status,
      startedAt: tool.createdAt,
      row: <StretchToolRow tool={tool} />,
      body: toolHasBody(tool, command) ? <ToolBody tool={tool} command={command} /> : undefined,
    };
  }
  if (member.kind === 'reasoning' && part?.type === 'reasoning') {
    const content = getReasoningContent(reasoningWithState(part, member.entryStreaming));
    return content && { kind: 'thought', key: member.key, content };
  }
  return undefined;
}

function callState(member: StretchMember): ActivityCallState[] {
  if (member.kind !== 'tool') return [];
  const { toolName, args, status, createdAt } = toolFromInvocationPart(
    member.part,
    member.runtime,
    member.messageCreatedAt,
  );
  return [{ toolName, args, status, startedAt: createdAt }];
}

/**
 * The stretch an entry hosts. Its own members show only once revealed, so streaming reasoning keeps its pacing;
 * members from later entries are already settled. A live one takes the run's indicator over from the tail
 * line, so it draws from the start, and moves into place instead of fading in.
 */
export function HostedStretch({
  stretch,
  hostEntryId,
  revealed,
}: {
  stretch: ActivityStretch;
  hostEntryId: string;
  revealed: ReadonlyMap<string, MessagePart>;
}) {
  const [takesOverIndicator] = useState(stretch.live);
  const members = stretch.members.flatMap(member => {
    const shown = activityMember(member, member.entryId === hostEntryId ? revealed.get(member.key) : member.part);
    return shown ? [shown] : [];
  });
  if (members.length === 0 && !stretch.live) return null;
  const current = stretch.live ? stretch.members.flatMap(callState) : undefined;

  const line = (
    <ActivityStretchLine members={members} live={stretch.live} elapsedMs={stretch.elapsedMs} current={current} />
  );
  return takesOverIndicator ? <Continuing>{line}</Continuing> : <Arriving>{line}</Arriving>;
}
