import type { PlanResume } from '@mastra/client-js';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { useRevealedParts } from '@mastra/playground-ui/components/ai/message-reveal';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageFactory } from '@mastra/react/ui';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react/ui';
import { useState } from 'react';

import type { MessageEntry, SuspensionPrompt } from '../services/transcript';
import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { MESSAGE_HOVER, MessageMeta } from './MessageMeta';
import { parseSkillActivation, SkillMessage } from './SkillMessage';
import { ToolCard } from './tool/ToolCard';
import { ToolGroup } from './tool/ToolGroup';
import { ToolFactory } from './ToolFactory';
import { collectToolGroups, draws, messageText, renderableParts, toolFromInvocationPart } from './transcript-parts';
import { isRecord, resultBlock, stringify } from './transcript-shared';
import {
  isSkillNotificationSignal,
  notificationMetadata,
  NotificationCard,
  NotificationSummaryCard,
} from './TranscriptNotifications';
import {
  HIDDEN_REACTIVE_SIGNAL_TAGS,
  SignalRow,
  signalRowView,
  SUPPRESSED_STATE_SIGNAL_IDS,
  TimeGap,
} from './TranscriptSignals';

const CHANNEL_PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

/**
 * Channel provenance for a message that arrived via a channel adapter.
 * `agent-channels` stamps `content.providerMetadata.mastra.channels.<platform>`
 * with author facts on inbound messages exactly so UIs can show origin
 * without unpacking the signal envelope.
 */
export function channelOrigin(entry: MessageEntry): { platform: string; authorName?: string } | undefined {
  const mastra = entry.message.content.providerMetadata?.mastra;
  const channels = isRecord(mastra) ? mastra.channels : undefined;
  if (!isRecord(channels)) return undefined;
  const platform = Object.keys(channels)[0];
  if (!platform) return undefined;
  const info = channels[platform];
  const author = isRecord(info) && isRecord(info.author) ? info.author : undefined;
  const authorName =
    typeof author?.fullName === 'string'
      ? author.fullName
      : typeof author?.userName === 'string'
        ? author.userName
        : undefined;
  return { platform, authorName };
}

export function ChannelOriginBadge({ origin }: { origin: { platform: string; authorName?: string } }) {
  const label = CHANNEL_PLATFORM_LABEL[origin.platform] ?? origin.platform;
  return (
    <div className="text-ui-xs text-icon3 mt-1 flex items-center gap-1" aria-label={`Sent from ${label}`}>
      {origin.platform === 'slack' && <SlackIcon className="size-3" aria-hidden="true" />}
      <span>
        via {label}
        {origin.authorName ? ` · ${origin.authorName}` : ''}
      </span>
    </div>
  );
}

function steeringLabel(entry: MessageEntry): string | undefined {
  if (!entry.steer) return undefined;
  if (entry.deliveryStatus === 'pending') return 'Steering…';
  if (entry.deliveryStatus === 'failed') return 'Not sent';
  return 'Steered message';
}

/**
 * What the meta row stamps and offers to copy. A user's own words are their message;
 * an assistant's are the whole turn's answer, which reaches the timeline split across
 * one message per step — so only the message closing it carries the row, and a reply
 * still being written carries none.
 */
function metaText(entry: MessageEntry, prose: string, reply?: string): string | undefined {
  if (entry.message.role === 'user') return prose || undefined;

  return entry.streaming ? undefined : reply;
}

/**
 * One message, drawn at the pace it was written. The reveal is owned here rather than
 * inside the markdown, because a reply is prose *and* the rows written between its
 * passages: paced from one place, they land in the order the model wrote them.
 */
export function MessageBubble({
  entry,
  suspensions,
  reply,
  isSubmitting,
  onRespond,
}: {
  entry: MessageEntry;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  /** The whole turn's answer, on the last message it was split across — the meta row's text. */
  reply?: string;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  const written = renderableParts(entry);
  const parts = useRevealedParts(written, Boolean(entry.streaming));
  // Decided the first time the entry is drawn and never revisited: only calls already
  // there when the reader arrived may fold into a group. A call landing under them —
  // a live run being watched, or one restored mid-run — stays the row it played as.
  const [groupable] = useState<ReadonlySet<string>>(() =>
    entry.streaming
      ? new Set()
      : new Set(written.flatMap(part => (part.type === 'tool-invocation' ? [part.toolInvocation.toolCallId] : []))),
  );
  // Always the projected parts, never the raw message: a partially revealed part
  // keeps the same part count as the full one, so no cheap identity check can
  // tell them apart — and this sits inside the entry's memo, so a fresh object
  // per render reaches only the one bubble already being redrawn.
  const message = { ...entry.message, content: { ...entry.message.content, parts } };
  const hasRenderablePart = written.some(part => draws(part, suspensions, entry.runtimeTools));

  const toolGroups = collectToolGroups(parts, suspensions, entry.runtimeTools, groupable);
  const origin = channelOrigin(entry);
  const prose = messageText(written);
  const meta = metaText(entry, prose, reply);
  const steeringStatus = steeringLabel(entry);
  const steeringPending = entry.deliveryStatus === 'pending';
  const steeringFailed = entry.deliveryStatus === 'failed';
  const roles: MessageRoleRenderers = {
    User: ({ children }) => (
      <div className={cn(MESSAGE_HOVER, 'my-3 ml-auto flex w-fit max-w-[70%] flex-col items-end')}>
        <div
          className={cn(
            'text-text1 bg-neutral6/5 rounded-xl border border-transparent px-4 py-2 break-words',
            steeringPending && 'border-border1 border-dashed',
          )}
        >
          {children}
        </div>
        {steeringStatus && (
          <span
            className={cn('text-ui-xs text-icon3 mt-1', steeringFailed && 'text-notice-destructive-fg')}
            aria-live="polite"
          >
            {steeringStatus}
          </span>
        )}
        {origin && <ChannelOriginBadge origin={origin} />}
        {meta ? <MessageMeta text={meta} createdAt={entry.message.createdAt} align="end" /> : null}
      </div>
    ),
    Assistant: ({ children }) => (
      // The trailing margin of the last part spaced this message from the next
      // entry; the meta row inherits it as a gap unless it moves to the wrapper.
      <div className={cn(MESSAGE_HOVER, 'max-w-full', meta && 'mb-3 [&>*:nth-last-child(2)]:mb-0')}>
        {children}
        {meta ? <MessageMeta text={meta} createdAt={entry.message.createdAt} align="start" /> : null}
      </div>
    ),
    System: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
    Signal: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
  };

  const renderers = {
    Text: (part: TextPart) => {
      if (!part.text.trim()) return null;
      if (entry.message.role === 'user') {
        const activation = parseSkillActivation(part.text);
        return activation ? <SkillMessage activation={activation} /> : <MarkdownRenderer>{part.text}</MarkdownRenderer>;
      }

      return (
        <MarkdownRenderer className="my-3" streaming={entry.streaming}>
          {part.text}
        </MarkdownRenderer>
      );
    },
    Reasoning: (part: ReasoningPart) => {
      if (!part.reasoning.trim()) return null;
      return (
        <div className="border-border1 my-1.5 border-l-2 pl-2.5 italic [&_p]:my-0.5">
          <MarkdownRenderer className="text-ui-sm text-icon3" streaming={entry.streaming}>
            {part.reasoning}
          </MarkdownRenderer>
        </div>
      );
    },
    ToolInvocation: (part: ToolInvocationPart) => {
      const toolCallId = part.toolInvocation.toolCallId;
      const group = toolGroups.byFirstId.get(toolCallId);
      if (group)
        return (
          <Arriving>
            <ToolGroup tools={group} />
          </Arriving>
        );
      if (toolGroups.memberIds.has(toolCallId)) return null;

      const runtime = entry.runtimeTools?.[toolCallId];
      const tool = toolFromInvocationPart(part, runtime);
      const suspension = suspensions.get(tool.toolCallId);
      return (
        <Arriving>
          <ToolFactory
            toolName={tool.toolName}
            toolCallId={tool.toolCallId}
            input={suspension?.suspendPayload ?? tool.args}
            output={tool.result}
            status={suspension ? 'running' : tool.status}
            isSubmitting={isSubmitting}
            onRespond={suspension ? response => onRespond(tool.toolCallId, response, suspension.id) : undefined}
            fallback={() => <ToolCard tool={tool} />}
          />
        </Arriving>
      );
    },
    File: (part: FilePart) => <FileAttachment part={part} />,
  };

  const skillActivation =
    entry.message.role === 'user' && parts.length === 1 && parts[0].type === 'text'
      ? parseSkillActivation(parts[0].text)
      : undefined;
  if (skillActivation) {
    return skillActivation.feed === undefined ? (
      <SkillMessage activation={skillActivation} />
    ) : (
      <div className="flex flex-col">
        <SkillMessage activation={skillActivation} />
        <SignalRow kind="reactive" label="Work item feed" message={skillActivation.feed} />
      </div>
    );
  }
  if (isSkillNotificationSignal(entry)) return null;

  const notifications = notificationMetadata(entry);
  if (notifications.length > 0) {
    return (
      <div className="flex flex-col">
        {notifications.map(notification =>
          notification.kind === 'notification' ? (
            <NotificationCard key={notification.id} entry={notification} />
          ) : (
            <NotificationSummaryCard key={notification.id} entry={notification} />
          ),
        )}
        {hasRenderablePart && entry.message.role !== 'signal' && (
          <MessageFactory message={message} roles={roles} {...renderers} fallback={() => null} />
        )}
      </div>
    );
  }

  const signalRow = signalRowView(entry);
  if (signalRow) {
    if (signalRow.kind === 'state') {
      if (SUPPRESSED_STATE_SIGNAL_IDS.has(signalRow.stateId)) return null;
      return (
        <SignalRow kind="state" label={`State ${signalRow.mode}: ${signalRow.stateId}`} message={signalRow.text} />
      );
    }
    if (signalRow.kind === 'gap') return <TimeGap text={signalRow.text} />;
    if (signalRow.kind === 'reminder') {
      return <SignalRow kind="reminder" label="System reminder" message={signalRow.text} />;
    }
    if (!signalRow.tagName || HIDDEN_REACTIVE_SIGNAL_TAGS.has(signalRow.tagName)) return null;
    return <SignalRow kind="reactive" label={signalRow.tagName} message={signalRow.text} />;
  }

  const status = statusMetadata(entry);
  // Some harness status parts (e.g. om_* markers) carry no text. Ignore the
  // marker while preserving any ordinary assistant content in the message.
  if (status?.text.trim()) return <StatusMetadataCard status={status} />;
  if (!hasRenderablePart) return null;

  return <MessageFactory message={message} roles={roles} {...renderers} fallback={() => null} />;
}

function FileAttachment({ part }: { part: FilePart }) {
  if (part.mimeType?.startsWith('image/')) {
    const src = part.data.startsWith('data:') ? part.data : `data:${part.mimeType};base64,${part.data}`;
    return (
      <img src={src} alt="Attached image" className="border-border1 my-1.5 max-h-80 max-w-full rounded-md border" />
    );
  }
  return <pre className={resultBlock}>{stringify(part)}</pre>;
}

interface StatusMetadata {
  id: string;
  text: string;
  level: 'info' | 'error';
}

function statusMetadata(entry: MessageEntry): StatusMetadata | undefined {
  const harnessContent = entry.message.content.metadata?.harnessContent;
  if (!Array.isArray(harnessContent)) return undefined;

  const statusPart = harnessContent.find(
    part =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      typeof part.type === 'string' &&
      (part.type === 'notification_summary' || part.type.startsWith('om_') || part.type === 'harness-error'),
  );
  if (!statusPart || typeof statusPart !== 'object' || !('type' in statusPart)) return undefined;

  const text =
    'text' in statusPart && typeof statusPart.text === 'string'
      ? statusPart.text
      : 'message' in statusPart && typeof statusPart.message === 'string'
        ? statusPart.message
        : '';
  return {
    id: `${entry.id}-${String(statusPart.type)}`,
    text,
    level: statusPart.type === 'harness-error' ? 'error' : 'info',
  };
}

function StatusMetadataCard({ status }: { status: StatusMetadata }) {
  return (
    <Notice className="my-2" variant={status.level === 'error' ? 'destructive' : 'info'}>
      {status.text}
    </Notice>
  );
}
