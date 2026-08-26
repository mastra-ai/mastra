import type { PlanResume } from '@mastra/client-js';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { MessageScrollerItem } from '@mastra/playground-ui/components/MessageScroller';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { startsUserTurn } from '@mastra/playground-ui/components/ThreadRail';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';

import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useApproveAgentControllerToolMutation,
  useRespondAgentControllerSuspensionMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { groupTurns, replySteps } from '../services/turns';
import { ArrivalScope, useArriving } from '@mastra/playground-ui/components/Arrival';
import { MessageBubble } from './MessageBubble';
import { draws, messageText, renderableParts } from './transcript-parts';
import { NotificationCard, NotificationSummaryCard } from './TranscriptNotifications';
import { ApprovalCard, SubagentCard, SuspensionCard } from './TranscriptPromptCards';
import { isTimeGap } from './TranscriptSignals';

import type { MessageEntry, NoticeEntry, SuspensionPrompt, TimelineEntry } from '../services/transcript';

export function Transcript({ tail }: { tail?: ReactNode }) {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { transcript, resolvePrompt, busy } = useChatTranscript();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const { mutateAsync: approve, isPending: approving } = useApproveAgentControllerToolMutation(hookArgs);
  const { mutateAsync: respond, isPending: responding } = useRespondAgentControllerSuspensionMutation(hookArgs);

  // Pinned: these reach every entry, and a fresh pair each token would redraw the lot.
  const onApprove = useCallback(
    async (toolCallId: string, approved: boolean, promptId: string) => {
      await approve({ toolCallId, approved });
      resolvePrompt(promptId);
    },
    [approve, resolvePrompt],
  );
  const onRespond = useCallback(
    async (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => {
      await respond({ toolCallId, resumeData });
      resolvePrompt(promptId);
    },
    [respond, resolvePrompt],
  );

  return (
    <ArrivalScope>
      <TranscriptEntries
        entries={transcript.entries}
        restoredHistory
        isSubmitting={approving || responding}
        onApprove={onApprove}
        onRespond={onRespond}
        running={busy}
        tail={tail}
      />
    </ArrivalScope>
  );
}

export function TranscriptEntries({
  entries,
  restoredHistory = false,
  isSubmitting = false,
  onApprove,
  onRespond,
  running = false,
  tail,
}: {
  entries: TimelineEntry[];
  restoredHistory?: boolean;
  isSubmitting?: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
  /** Holds the room open under the live turn, and releases it when the agent stops. */
  running?: boolean;
  /** Rendered inside the live turn (the activity line), so the reserved room stays under it. */
  tail?: ReactNode;
}) {
  const prompts = entries.flatMap(entry => (entry.kind === 'suspension' ? [entry] : []));
  // Keyed by the prompts on screen, not by the array holding them: a delta hands this
  // component a new `entries` every token, and a map rebuilt each time would be a new
  // prop on every settled entry, undoing the memo below.
  const promptKey = prompts.map(prompt => prompt.id).join('\n');
  const suspensions = useMemo(() => new Map(prompts.map(prompt => [prompt.toolCallId, prompt] as const)), [promptKey]);
  const canonicalToolCallIds = new Set(
    entries.flatMap(entry =>
      entry.kind === 'message'
        ? entry.message.content.parts.flatMap(part =>
            part.type === 'tool-invocation' ? [part.toolInvocation.toolCallId] : [],
          )
        : [],
    ),
  );

  // Ignore echoed user signals that render nothing when opening a turn.
  const drawsContent = (entry: MessageEntry): boolean =>
    entry.message.content.parts.some(part => draws(part, suspensions, entry.runtimeTools));
  const opensTurn = (entry: TimelineEntry): boolean =>
    entry.kind === 'message' && startsUserTurn(entry.message) && drawsContent(entry);
  // A steer interjects into a reply still being written: it keeps its turn for the
  // rail and history, but claims no room and no trip — the reader stays with the stream.
  const steers = (entry: TimelineEntry | undefined): boolean => entry?.kind === 'message' && Boolean(entry.steer);

  const turnGroups = groupTurns(entries, opensTurn, isTimeGap);
  const [restoredTurnKey] = useState(() => (restoredHistory ? turnGroups.at(-1)?.key : undefined));

  return (
    <>
      {turnGroups.map((group, index) => {
        const isLiveTurn = index === turnGroups.length - 1;
        const runningTurn = isLiveTurn && running;
        // Closing turns keep their room class so reserved space releases through its
        // transition. The first turn opens at the top of the transcript already, so
        // room under it would buy no travel — only empty scroll below a fresh thread.
        const holdsRoom =
          runningTurn && group.opensTurn && index > 0 && !steers(group.entries.find(entry => entry.id === group.key));
        const openRoomClass = group.key === restoredTurnKey ? 'turn-room-restored-open' : 'turn-room-open';

        // One reply, however many messages the server split it into: the meta row lands
        // once, under the last of them, and copies the whole answer. While the run is
        // still answering there is no whole answer yet — a step ending is not the reply
        // ending, so no stamp lands mid-turn.
        const steps = replySteps(group);
        const replyEnd = steps.at(-1);
        const reply = runningTurn
          ? undefined
          : steps
              .map(step => messageText(renderableParts(step)))
              .filter(Boolean)
              .join('\n\n');

        return (
          <div
            key={group.key}
            className={cn('flex flex-col', group.opensTurn && 'turn-room', holdsRoom && openRoomClass)}
          >
            {group.entries.map(entry => (
              <TranscriptItem key={entry.id} entry={entry} scrollAnchor={opensTurn(entry) && !steers(entry)}>
                <TranscriptEntryContent
                  entry={entry}
                  suspensions={suspensions}
                  reply={entry === replyEnd ? reply : undefined}
                  redundantSuspension={
                    entry.kind === 'suspension' &&
                    entry.toolName !== 'request_access' &&
                    canonicalToolCallIds.has(entry.toolCallId)
                  }
                  isSubmitting={isSubmitting}
                  onApprove={onApprove}
                  onRespond={onRespond}
                />
              </TranscriptItem>
            ))}
            {isLiveTurn && tail}
          </div>
        );
      })}
      {turnGroups.length === 0 && tail}
    </>
  );
}

/**
 * What one entry draws. Memoized on its own props, because a token landing on the live
 * reply hands this list a new array while every settled entry in it is the same object:
 * only the entry that changed is worth drawing again.
 *
 * `redundantSuspension` arrives decided rather than as the set it was decided from —
 * the set grows with every tool call, and passing it would re-render the whole
 * transcript each time one starts.
 */
const TranscriptEntryContent = memo(function TranscriptEntryContent({
  entry,
  suspensions,
  reply,
  redundantSuspension,
  isSubmitting,
  onApprove,
  onRespond,
}: {
  entry: TimelineEntry;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  reply?: string;
  redundantSuspension: boolean;
  isSubmitting: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  switch (entry.kind) {
    case 'message':
      return (
        <MessageBubble
          entry={entry}
          suspensions={suspensions}
          reply={reply}
          isSubmitting={isSubmitting}
          onRespond={onRespond}
        />
      );
    case 'notice':
      return <NoticeCard entry={entry} />;
    case 'approval':
      return <ApprovalCard prompt={entry} isSubmitting={isSubmitting} onApprove={onApprove} />;
    case 'notification':
      return <NotificationCard entry={entry} />;
    case 'notification_summary':
      return <NotificationSummaryCard entry={entry} />;
    case 'suspension':
      return redundantSuspension ? null : (
        <SuspensionCard prompt={entry} isSubmitting={isSubmitting} onRespond={onRespond} />
      );
    case 'subagent':
      return <SubagentCard entry={entry} />;
    default:
      return null;
  }
});

function TranscriptItem({
  entry,
  scrollAnchor,
  children,
}: {
  entry: TimelineEntry;
  scrollAnchor: boolean;
  children: ReactNode;
}) {
  const arriving = useArriving();

  return (
    <MessageScrollerItem
      messageId={entry.id}
      scrollAnchor={scrollAnchor}
      // Prepend anchoring needs real item heights, not off-screen estimates.
      className={cn('[content-visibility:visible]', arriving)}
    >
      <ArrivalScope>{children}</ArrivalScope>
    </MessageScrollerItem>
  );
}

function NoticeCard({ entry }: { entry: NoticeEntry }) {
  return (
    <Notice className="my-2" variant={entry.level === 'error' ? 'destructive' : 'info'}>
      <MarkdownRenderer className="text-current">{entry.text}</MarkdownRenderer>
    </Notice>
  );
}
