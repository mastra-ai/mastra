import type { PlanResume } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';
import type { ThreadOwner } from '../services/reply-credential';
import type { MessageEntry, NoticeEntry, SuspensionPrompt, TimelineEntry } from '../services/transcript';
import { replySteps } from '../services/turns';
import { hasLiveStretch, planTurnActivity, sameEntryActivity } from './activity/activity-plan';
import type { EntryActivity } from './activity/activity-plan';
import { MessageBubble } from './MessageBubble';

import { agentWorkingDirectory, isTurnDivider } from './signals';
import { ApprovalCard, DefaultNotification, DefaultRunError, DefaultSuspension, useTranscriptSlots } from './slots';
import { draws, messageText, renderableParts } from './transcript-parts';
import type { DrawsDataPart } from './transcript-parts';
import { isRecord } from './transcript-shared';
import { turnGaps } from './turn-gaps';
import { TurnRevealScope } from './TurnReveal';
import { ActivityDisclosureProvider } from '@/domains/chat/activity';
import { ActivityWorkingDirectory } from '@/ds/components/ai/activity';
import { TranscriptDivider } from '@/ds/components/ai/transcript-divider';
import { ArrivalScope, useArriving } from '@/ds/components/Arrival';
import { ChatShell } from '@/ds/components/ChatShell';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { MessageScrollerItem } from '@/ds/components/MessageScroller';
import { Notice } from '@/ds/components/Notice';
import { groupTurns, startsUserTurn } from '@/ds/components/ThreadRail';

import { cn } from '@/utils/cn';

/** The live turn's last row, told whether a live stretch above it already names what the agent is doing. */
export type TranscriptTail = (stretchLive: boolean) => ReactNode;

/** A step ending is not the reply ending, so a running turn has no whole answer to copy yet. */
function turnReply(
  steps: MessageEntry[],
  runningTurn: boolean,
  drawsData: DrawsDataPart | undefined,
): string | undefined {
  if (runningTurn) return undefined;
  return steps
    .map(step => messageText(renderableParts(step, drawsData)))
    .filter(Boolean)
    .join('\n\n');
}

export function TranscriptEntries({
  entries,
  restoredHistory = false,
  isSubmitting = false,
  onApprove,
  onRespond,
  running = false,
  viewerId,
  owner,
  tail,
}: {
  entries: TimelineEntry[];
  restoredHistory?: boolean;
  isSubmitting?: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
  /** Holds the room open under the live turn, and releases it when the agent stops. */
  running?: boolean;
  /** The signed-in user; anyone else's message gets their avatar beside it. */
  viewerId?: string;
  /** Whose personal credentials the thread runs on; names their replies for other viewers. */
  owner?: ThreadOwner;
  /** Rendered inside the live turn (the activity line), so the reserved room stays under it. */
  tail?: TranscriptTail;
}) {
  const drawsData = useTranscriptSlots().DataPart?.draws;
  const prompts = entries.flatMap(entry => (entry.kind === 'suspension' ? [entry] : []));
  // Keyed by the prompts on screen, not by the array holding them: a delta hands this
  // component a new `entries` every token, and a map rebuilt each time would be a new
  // prop on every settled entry, undoing the memo below.
  const promptKey = prompts.map(prompt => prompt.id).join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by prompt ids so token deltas keep the map stable
  const suspensions = useMemo(() => new Map(prompts.map(prompt => [prompt.toolCallId, prompt] as const)), [promptKey]);
  const canonicalToolCallIds = new Set(
    entries.flatMap(entry =>
      entry.kind === 'message'
        ? entry.message.content.parts.flatMap(part =>
            isRecord(part) && part.type === 'tool-invocation' ? [part.toolInvocation.toolCallId] : [],
          )
        : [],
    ),
  );

  // Ignore echoed user signals that render nothing when opening a turn.
  const drawsContent = (entry: MessageEntry): boolean =>
    entry.message.content.parts.some(part => draws(part, entry, suspensions, drawsData));
  const opensTurn = (entry: TimelineEntry): boolean =>
    entry.kind === 'message' && startsUserTurn(entry.message) && drawsContent(entry);
  // A steer interjects into a reply still being written: it keeps its turn for the
  // rail and history, but claims no room and no trip — the reader stays with the stream.
  const steers = (entry: TimelineEntry | undefined): boolean => entry?.kind === 'message' && Boolean(entry.steer);

  const turnGroups = groupTurns(entries, { key: entry => entry.id, opensTurn, introduces: isTurnDivider });
  const [restoredTurnKey] = useState(() => (restoredHistory ? turnGroups.at(-1)?.key : undefined));
  const gaps = turnGaps(entries, opensTurn);
  const directories = turnGroups.reduce<(string | undefined)[]>(
    (held, group) => [...held, agentWorkingDirectory(group.entries) ?? held.at(-1)],
    [],
  );

  return (
    <ActivityDisclosureProvider>
      {turnGroups.map((group, index) => {
        const isLiveTurn = index === turnGroups.length - 1;
        const runningTurn = isLiveTurn && running;
        // The first turn opens at the top of the transcript already, so room under it
        // would buy no travel — only empty scroll below a fresh thread.
        const holdsRoom =
          runningTurn && group.opensTurn && index > 0 && !steers(group.entries.find(entry => entry.id === group.key));

        const steps = replySteps(group);
        const replyEnd = steps.at(-1);
        const reply = turnReply(steps, runningTurn, drawsData);
        const activityByEntry = planTurnActivity(group.entries, suspensions, runningTurn, drawsData);

        return (
          <ChatShell.Turn
            key={group.key}
            opensTurn={group.opensTurn}
            holdsRoom={holdsRoom}
            restored={group.key === restoredTurnKey}
          >
            <ActivityWorkingDirectory path={directories[index]}>
              <TurnRevealScope>
                {group.entries.map(entry => {
                  const gap = gaps.get(entry.id);
                  return (
                    <TranscriptItem key={entry.id} entry={entry} scrollAnchor={opensTurn(entry) && !steers(entry)}>
                      {gap && <TranscriptDivider label={gap.label} title={gap.title} />}
                      <TranscriptEntryContent
                        entry={entry}
                        suspensions={suspensions}
                        reply={entry === replyEnd ? reply : undefined}
                        activity={activityByEntry.get(entry.id)}
                        redundantSuspension={
                          entry.kind === 'suspension' &&
                          entry.toolName !== 'request_access' &&
                          canonicalToolCallIds.has(entry.toolCallId)
                        }
                        isSubmitting={isSubmitting}
                        viewerId={viewerId}
                        owner={owner}
                        onApprove={onApprove}
                        onRespond={onRespond}
                      />
                    </TranscriptItem>
                  );
                })}
              </TurnRevealScope>
              {isLiveTurn && tail?.(hasLiveStretch(activityByEntry))}
            </ActivityWorkingDirectory>
          </ChatShell.Turn>
        );
      })}
      {turnGroups.length === 0 && tail?.(false)}
    </ActivityDisclosureProvider>
  );
}

interface TranscriptEntryContentProps {
  entry: TimelineEntry;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  reply?: string;
  redundantSuspension: boolean;
  isSubmitting: boolean;
  viewerId?: string;
  owner?: ThreadOwner;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
  activity?: EntryActivity;
}

/** The turn's plan is rebuilt every token: compare `activity` by what it draws, the rest by identity. */
function sameEntryContentProps(
  { activity: prevActivity, ...prev }: TranscriptEntryContentProps,
  { activity: nextActivity, ...next }: TranscriptEntryContentProps,
): boolean {
  if (!sameEntryActivity(prevActivity, nextActivity)) return false;
  const nextProps = new Map(Object.entries(next));
  const prevProps = Object.entries(prev);
  return (
    prevProps.length === nextProps.size && prevProps.every(([name, value]) => Object.is(value, nextProps.get(name)))
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
  viewerId,
  owner,
  onApprove,
  onRespond,
  activity,
}: TranscriptEntryContentProps) {
  const { Approval, Suspension, Subagent, Notification, NotificationSummary, SubmitPlan } = useTranscriptSlots();
  switch (entry.kind) {
    case 'message':
      return (
        <MessageBubble
          entry={entry}
          suspensions={suspensions}
          reply={reply}
          isSubmitting={isSubmitting}
          viewerId={viewerId}
          owner={owner}
          onRespond={onRespond}
          activity={activity}
        />
      );
    case 'notice':
      return <NoticeCard entry={entry} />;
    case 'approval': {
      const Row = Approval ?? ApprovalCard;
      return <Row prompt={entry} isSubmitting={isSubmitting} onApprove={onApprove} />;
    }
    case 'notification':
      return Notification ? <Notification entry={entry} /> : <DefaultNotification entry={entry} />;
    case 'notification_summary':
      return NotificationSummary ? <NotificationSummary entry={entry} /> : <DefaultNotification entry={entry} />;
    case 'suspension': {
      if (Suspension) {
        return redundantSuspension ? null : (
          <Suspension prompt={entry} isSubmitting={isSubmitting} onRespond={onRespond} />
        );
      }
      const payload = entry.suspendPayload ?? entry.args;
      const answeredInline =
        (isRecord(payload) && typeof payload.question === 'string' && payload.question.length > 0) ||
        (entry.toolName === 'submit_plan' && SubmitPlan !== undefined);
      return redundantSuspension && answeredInline ? null : <DefaultSuspension prompt={entry} />;
    }
    case 'subagent':
      return Subagent ? <Subagent entry={entry} /> : null;
    default:
      return null;
  }
}, sameEntryContentProps);

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
      className={cn('[content-visibility:visible] empty:hidden', arriving)}
    >
      <ArrivalScope>{children}</ArrivalScope>
    </MessageScrollerItem>
  );
}

function NoticeCard({ entry }: { entry: NoticeEntry }) {
  const RunErrorNotice = useTranscriptSlots().RunError ?? DefaultRunError;
  if (entry.error) return <RunErrorNotice error={entry.error} entryId={entry.id} />;
  return (
    <Notice className="my-2" variant={entry.level === 'error' ? 'destructive' : 'info'}>
      <MarkdownRenderer className="text-current">{entry.text}</MarkdownRenderer>
    </Notice>
  );
}
