import type { PlanResume } from '@mastra/client-js';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { useRevealedParts } from '@mastra/playground-ui/components/ai/message-reveal';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ReasoningPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/reasoning-part-renderer';
import { UserFilePartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/user-file-part-renderer';
import { MessageFactory } from '@mastra/react/ui';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react/ui';

import { channelOrigin, messageAuthor } from '../services/message-author';
import type { MessageEntry, SuspensionPrompt } from '../services/transcript';
import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { Message, MessageActions, MessageCopyButton, MessageTimestamp } from '@mastra/playground-ui/components/Message';
import { ChannelOriginBadge, SenderAvatar } from './MessageSender';
import { parseSkillActivation, SkillMessage } from './SkillMessage';
import { ToolCard } from './tool/ToolCard';
import { ToolGroup } from './tool/ToolGroup';
import { ToolFactory } from './ToolFactory';
import { collectToolGroups, draws, messageText, renderableParts, toolFromInvocationPart } from './transcript-parts';
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
import type { MastraErrorPart } from '@mastra/core/agent/message-list';

function steeringLabel(entry: MessageEntry): string | undefined {
  if (!entry.steer) return undefined;
  if (entry.deliveryStatus === 'pending') return 'Steering…';
  if (entry.deliveryStatus === 'failed') return 'Not sent';
  return 'Steered message';
}

function metaText(entry: MessageEntry, prose: string, reply?: string): string | undefined {
  if (entry.message.role === 'user') return prose || undefined;

  return entry.streaming ? undefined : reply;
}

export function MessageBubble({
  entry,
  suspensions,
  reply,
  isSubmitting,
  onRespond,
  viewerId,
}: {
  entry: MessageEntry;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  reply?: string;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
  viewerId?: string;
}) {
  const written = renderableParts(entry);
  const parts = useRevealedParts(written, Boolean(entry.streaming));
  const message = { ...entry.message, content: { ...entry.message.content, parts } };
  const hasRenderablePart = written.some(part => draws(part, suspensions, entry.runtimeTools));

  const toolGroups = collectToolGroups(parts, suspensions);
  const origin = channelOrigin(entry.message);
  const author = messageAuthor(entry.message);
  const sender = author && author.id !== viewerId ? author : undefined;
  const prose = messageText(written);
  const meta = metaText(entry, prose, reply);
  const steeringStatus = steeringLabel(entry);
  const steeringPending = entry.deliveryStatus === 'pending';
  const steeringFailed = entry.deliveryStatus === 'failed';
  const messageActions = meta ? (
    <MessageActions>
      <MessageCopyButton text={meta} />
      <MessageTimestamp value={entry.message.createdAt} />
    </MessageActions>
  ) : undefined;
  const roles: MessageRoleRenderers = {
    User: ({ children }) => (
      <Message
        from="user"
        pending={steeringPending}
        avatar={sender && <SenderAvatar author={sender} />}
        footer={
          <>
            {steeringStatus && (
              <span
                className={cn('text-meta text-muted-foreground', steeringFailed && 'text-notice-destructive-fg')}
                aria-live="polite"
              >
                {steeringStatus}
              </span>
            )}
            {origin && <ChannelOriginBadge origin={origin} />}
            {messageActions}
          </>
        }
      >
        {children}
      </Message>
    ),
    Assistant: ({ children }) => (
      <Message from="assistant" footer={messageActions}>
        {children}
      </Message>
    ),
    System: ({ children }) => <div className="text-caption text-muted-foreground">{children}</div>,
    Signal: ({ children }) => <div className="text-caption text-muted-foreground">{children}</div>,
  };

  const renderers = {
    Error: (part: MastraErrorPart) => (
      <Notice variant="destructive" title={part.error.name ?? 'Error'}>
        <Notice.Message>{part.error.message}</Notice.Message>
      </Notice>
    ),
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
    Reasoning: (part: ReasoningPart) => (
      <ReasoningPartRenderer
        part={{ ...part, state: part.state ?? (entry.streaming ? 'streaming' : 'done') }}
        defaultOpen={false}
      />
    ),
    ToolInvocation: (part: ToolInvocationPart) => {
      const toolCallId = part.toolInvocation.toolCallId;
      const group = toolGroups.byFirstKey.get(toolCallId);
      if (group) {
        const tools = group.map(member =>
          toolFromInvocationPart(
            member,
            entry.runtimeTools?.[member.toolInvocation.toolCallId],
            entry.message.createdAt,
          ),
        );
        return (
          <Arriving>
            <ToolGroup tools={tools} />
          </Arriving>
        );
      }
      if (toolGroups.memberKeys.has(toolCallId)) return null;

      const runtime = entry.runtimeTools?.[toolCallId];
      const tool = toolFromInvocationPart(part, runtime, entry.message.createdAt);
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
    File: (part: FilePart) => <UserFilePartRenderer part={part} />,
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
  if (status?.text.trim()) return <StatusMetadataCard status={status} />;
  if (!hasRenderablePart) return null;

  return <MessageFactory message={message} roles={roles} {...renderers} fallback={() => null} />;
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
