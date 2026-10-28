import type { PlanResume } from '@mastra/client-js';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { useRevealedParts } from '@mastra/playground-ui/components/ai/message-reveal';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { ReasoningPartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/reasoning-part-renderer';
import { UserFilePartRenderer } from '@mastra/playground-ui/domains/chat/messages/renderers/user-file-part-renderer';
import { MessageAttachments } from '@mastra/playground-ui/domains/chat/attachments/message-attachments';
import { splitMessageAttachments } from '@mastra/playground-ui/domains/chat/attachments/split-message-attachments';
import { parseSkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';
import { SkillMessage } from '@mastra/playground-ui/domains/chat/messages/skill-message';
import { MessageFactory } from '@mastra/react/ui';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react/ui';

import { channelOrigin, messageAuthor } from '../services/message-author';
import { replyCredentialLabel } from '../services/reply-credential';
import type { ThreadOwner } from '../services/reply-credential';
import type { MessageEntry, SuspensionPrompt } from '../services/transcript';
import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { SignalActivity } from '@mastra/playground-ui/components/ai/activity';
import { TranscriptDivider } from '@mastra/playground-ui/components/ai/transcript-divider';
import {
  Message,
  MessageActions,
  MessageCopyButton,
  MessageMetadata,
  MessageTimestamp,
} from '@mastra/playground-ui/components/Message';
import { ChannelOriginBadge, SenderAvatar } from './MessageSender';
import { RunErrorNotice } from './RunErrorNotice';
import { ToolCard } from './tool/ToolCard';
import { ToolFactory } from './ToolFactory';
import { draws, hasVisibleText, messageText, renderableParts, toolFromInvocationPart } from './transcript-parts';
import { ActivityStretchLine } from './activity/ActivityStretchLine';
import { activityPartKey, reasoningWithState } from './activity/activity-plan';
import type { EntryActivity } from './activity/activity-plan';
import { NotificationCard, NotificationSummaryCard } from './TranscriptNotifications';
import { messageEntryView } from './message-entry-view';
import type { StatusMetadata } from './message-entry-view';
import type { MastraErrorPart } from '@mastra/core/agent/message-list';
import { Txt } from '@mastra/playground-ui/components/Txt';

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
  owner,
  activity,
}: {
  entry: MessageEntry;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  reply?: string;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
  viewerId?: string;
  owner?: ThreadOwner;
  /** The stretches of tool work this entry hosts, and the parts an earlier entry's stretch draws instead. */
  activity?: EntryActivity;
}) {
  const written = renderableParts(entry);
  const parts = useRevealedParts(written, Boolean(entry.streaming));
  const { attachments, content } =
    entry.message.role === 'user' ? splitMessageAttachments(parts) : { attachments: [], content: parts };
  const message = { ...entry.message, content: { ...entry.message.content, parts: content } };
  const hasRenderablePart = written.some(part => draws(part, suspensions, entry.runtimeTools));
  const drawsOwnPart = written.some((part, index) => {
    const key = activityPartKey(entry.id, part, index);
    if (activity?.hosts.has(key)) return true;
    return draws(part, suspensions, entry.runtimeTools) && !activity?.hidden.has(key);
  });
  const revealed = new Map(parts.map((part, index) => [activityPartKey(entry.id, part, index), part] as const));
  const keyOfPart = new Map<object, string>(parts.map((part, index) => [part, activityPartKey(entry.id, part, index)]));
  const stretchLine = (key: string | undefined) => {
    const stretch = key === undefined ? undefined : activity?.hosts.get(key);
    return (
      stretch && (
        <Arriving>
          <ActivityStretchLine stretch={stretch} hostEntryId={entry.id} revealed={revealed} />
        </Arriving>
      )
    );
  };

  const origin = channelOrigin(entry.message);
  const author = messageAuthor(entry.message);
  const sender = author && author.id !== viewerId ? author : undefined;
  const prose = messageText(entry.message.role === 'user' ? content : written);
  const meta = metaText(entry, prose, reply);
  const steeringStatus = steeringLabel(entry);
  const steeringPending = entry.deliveryStatus === 'pending';
  const steeringFailed = entry.deliveryStatus === 'failed';
  const metadata = entry.message.content.metadata;
  const modelId = typeof metadata?.modelId === 'string' ? metadata.modelId : undefined;
  const credentialLabel = modelId && metadata ? replyCredentialLabel(metadata, owner, viewerId) : undefined;
  const modelLabel = modelId && (
    <Tooltip>
      <TooltipTrigger
        render={
          <MessageMetadata tabIndex={0}>
            {formatModelName(modelId)}
            {credentialLabel && ` · ${credentialLabel}`}
          </MessageMetadata>
        }
      />
      <TooltipContent>{modelId}</TooltipContent>
    </Tooltip>
  );
  const replyFooter = (text: string) => ({
    model: modelLabel,
    actions: (
      <MessageActions>
        <MessageCopyButton text={text} />
        <MessageTimestamp value={entry.message.createdAt} />
      </MessageActions>
    ),
  });
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
        attachments={attachments.length > 0 && <MessageAttachments parts={attachments} />}
        avatar={sender && <SenderAvatar author={sender} />}
        footer={
          <>
            {steeringStatus && (
              <Txt
                as="span"
                variant="meta"
                tone="muted"
                className={cn(steeringFailed && 'text-destructive-foreground')}
                aria-live="polite"
              >
                {steeringStatus}
              </Txt>
            )}
            {origin && <ChannelOriginBadge origin={origin} />}
            {messageActions}
          </>
        }
      >
        {(attachments.length === 0 || content.length > 0) && children}
      </Message>
    ),
    Assistant: ({ children }) => (
      <Message
        from="assistant"
        footer={
          messageActions && (
            <div className="flex flex-wrap items-center gap-2">
              {modelLabel}
              {messageActions}
            </div>
          )
        }
      >
        {children}
      </Message>
    ),
    System: ({ children }) => <div className={textStyle({ variant: 'caption', tone: 'muted' })}>{children}</div>,
    Signal: ({ children }) => <div className={textStyle({ variant: 'caption', tone: 'muted' })}>{children}</div>,
  };

  const renderers = {
    Error: (part: MastraErrorPart) => <RunErrorNotice error={part.error} entryId={entry.id} />,
    Text: (part: TextPart) => {
      if (!hasVisibleText(part.text)) return null;
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
      const key = keyOfPart.get(part);
      const line = stretchLine(key);
      if (line) return line;
      if (key !== undefined && activity?.hidden.has(key)) return null;
      return <ReasoningPartRenderer part={reasoningWithState(part, Boolean(entry.streaming))} defaultOpen={false} />;
    },
    ToolInvocation: (part: ToolInvocationPart) => {
      const toolCallId = part.toolInvocation.toolCallId;
      const line = stretchLine(toolCallId);
      if (line) return line;
      if (activity?.hidden.has(toolCallId)) return null;

      const runtime = entry.runtimeTools?.[toolCallId];
      const tool = toolFromInvocationPart(part, runtime, entry.message.createdAt);
      const suspension = suspensions.get(tool.toolCallId);
      return (
        <Arriving>
          <ToolFactory
            toolName={tool.toolName}
            toolCallId={tool.toolCallId}
            input={suspension?.suspendPayload ?? tool.args}
            argsText={tool.argsText}
            replyFooter={replyFooter}
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

  const view = messageEntryView(entry, parts);
  switch (view.kind) {
    case 'skill':
      return <SkillMessage activation={view.activation} />;
    case 'hidden':
      return null;
    case 'notifications':
      return (
        <div className="flex flex-col">
          {view.notifications.map(notification =>
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
    case 'signal': {
      const { row } = view;
      if (row.kind === 'state') {
        return <SignalActivity kind="state" label={row.stateId} mode={row.mode} message={row.text} />;
      }
      if (row.kind === 'divider') return <TranscriptDivider label={row.label} title={row.title} />;
      if (row.kind === 'reminder') return <SignalActivity kind="reminder" label="System reminder" message={row.text} />;
      return <SignalActivity kind="reactive" label={row.tagName} message={row.text} />;
    }
    case 'status':
      return <StatusMetadataCard status={view.status} />;
    case 'parts':
      break;
  }
  // A step whose parts all draw inside an earlier step's stretch still carries the reply's footer when it ends the turn.
  if (!hasRenderablePart || (!drawsOwnPart && !meta)) return null;

  return <MessageFactory message={message} roles={roles} {...renderers} fallback={() => null} />;
}

function StatusMetadataCard({ status }: { status: StatusMetadata }) {
  return (
    <Notice className="my-2" variant={status.level === 'error' ? 'destructive' : 'info'}>
      {status.text}
    </Notice>
  );
}
