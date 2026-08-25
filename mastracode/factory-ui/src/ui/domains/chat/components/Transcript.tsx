import type { PlanResume } from '@mastra/client-js';
import { mastraDBMessageToSignal } from '@mastra/core/signals';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Input } from '@mastra/playground-ui/components/Input';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { MessageScrollerItem } from '@mastra/playground-ui/components/MessageScroller';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { startsUserTurn } from '@mastra/playground-ui/components/ThreadRail';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageFactory } from '@mastra/react/ui';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react/ui';
import { Bell, CircleDot, ExternalLink, Info, Layers, Slack } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useApproveAgentControllerToolMutation,
  useRespondAgentControllerSuspensionMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { isTerminalInvocationState } from '../services/transcript';
import { MESSAGE_HOVER, MessageMeta } from './MessageMeta';
import { ToolCard } from './tool/ToolCard';
import { ToolGroup, TOOL_GROUP_MIN } from './tool/ToolGroup';
import { SubmitPlanCard } from './SubmitPlanCard';
import { isTranscriptToolVisible, ToolFactory } from './ToolFactory';
import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from './TranscriptRow';

import type {
  ApprovalPrompt,
  MessageEntry,
  NoticeEntry,
  NotificationEntry,
  NotificationSummaryEntry,
  SubagentEntry,
  SuspensionPrompt,
  TimelineEntry,
  ToolCall,
} from '../services/transcript';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Monospace, scrollable container for serialized args/results/file dumps.
const resultBlock =
  'm-0 mt-1 max-h-72 max-w-full overflow-auto whitespace-pre rounded-sm bg-surface1 p-2 font-mono text-xs leading-normal text-icon5';

// Prompt cards (approval / suspension) — an elevated card with a colored left rail.
const promptCardBase = 'my-2 rounded-lg border border-border1 bg-surface3 px-4 py-3 shadow-md';
const promptCardApproval = `${promptCardBase} border-l-4 border-l-warning1`;
const promptCardSuspension = `${promptCardBase} border-l-4 border-l-accent2`;
const promptTitle = 'mb-1.5 text-sm font-semibold text-icon6';
const promptActions = 'mt-2 flex gap-2';

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function messageText(parts: MessageEntry['message']['content']['parts']): string {
  return parts
    .flatMap(part => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim();
}

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? id;
}

import { parseSkillActivation, SkillMessage } from './SkillMessage';

function hasProperty<K extends string>(value: object, key: K): value is object & Record<K, unknown> {
  return key in value;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !hasProperty(value, key)) return undefined;
  return typeof value[key] === 'string' ? value[key] : undefined;
}

// ---------------------------------------------------------------------------
// Approval prompt (tool_approval_required)
// ---------------------------------------------------------------------------

function ApprovalCard({
  prompt,
  isSubmitting,
  onApprove,
}: {
  prompt: ApprovalPrompt;
  isSubmitting: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
}) {
  return (
    <div className={promptCardApproval} role="group" aria-label={`Tool approval for ${prompt.toolName}`}>
      <div className={promptTitle}>
        Approve <code className="bg-surface5 rounded px-1.5 py-px font-mono text-xs">{prompt.toolName}</code>?
      </div>
      <pre className={resultBlock}>{truncate(stringify(prompt.args), 400)}</pre>
      <div className={promptActions}>
        <Button
          variant="primary"
          size="sm"
          aria-label={`Approve ${prompt.toolName}`}
          autoFocus
          disabled={isSubmitting}
          onClick={() => onApprove(prompt.toolCallId, true, prompt.id)}
        >
          Approve
        </Button>
        <Button
          size="sm"
          aria-label={`Decline ${prompt.toolName}`}
          disabled={isSubmitting}
          onClick={() => onApprove(prompt.toolCallId, false, prompt.id)}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspension prompt (ask_user / request_access / submit_plan)
// ---------------------------------------------------------------------------

interface SuspendPayloadShape {
  question?: string;
  options?: { label: string; description?: string }[];
  requestedPath?: string;
  reason?: string;
  plan?: { title?: string; summary?: string };
  title?: string;
}

function suspensionPayloadShape(payload: unknown): SuspendPayloadShape {
  const planValue = payload && typeof payload === 'object' && hasProperty(payload, 'plan') ? payload.plan : undefined;
  const plan =
    planValue && typeof planValue === 'object'
      ? {
          title: stringProperty(planValue, 'title'),
          summary: stringProperty(planValue, 'summary'),
        }
      : undefined;

  const optionsValue =
    payload && typeof payload === 'object' && hasProperty(payload, 'options') ? payload.options : undefined;
  const options = Array.isArray(optionsValue)
    ? optionsValue.flatMap(option => {
        const label = stringProperty(option, 'label');
        if (!label) return [];
        return [{ label, description: stringProperty(option, 'description') }];
      })
    : undefined;

  return {
    question: stringProperty(payload, 'question'),
    options,
    requestedPath: stringProperty(payload, 'requestedPath') ?? stringProperty(payload, 'path'),
    reason: stringProperty(payload, 'reason'),
    title: stringProperty(payload, 'title'),
    plan,
  };
}

function SuspensionCard({
  prompt,
  isSubmitting,
  onRespond,
}: {
  prompt: SuspensionPrompt;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  const payload = suspensionPayloadShape(prompt.suspendPayload);

  if (prompt.toolName === 'submit_plan') {
    return (
      <SubmitPlanCard
        toolCallId={prompt.toolCallId}
        input={prompt.suspendPayload}
        isSubmitting={isSubmitting}
        onRespond={response => onRespond(prompt.toolCallId, response, prompt.id)}
      />
    );
  }

  if (prompt.toolName === 'request_access') {
    return (
      <div className={promptCardSuspension} role="group" aria-label="Access request">
        <div className={promptTitle}>Grant access to {payload.requestedPath ?? 'a path'}?</div>
        {payload.reason && <div className="text-icon3 mt-0.5 text-xs">Reason: {payload.reason}</div>}
        <div className={promptActions}>
          <Button
            variant="primary"
            size="sm"
            aria-label={`Allow access to ${payload.requestedPath ?? 'the requested path'}`}
            autoFocus
            disabled={isSubmitting}
            onClick={() => onRespond(prompt.toolCallId, 'Yes', prompt.id)}
          >
            Allow
          </Button>
          <Button
            size="sm"
            aria-label={`Deny access to ${payload.requestedPath ?? 'the requested path'}`}
            disabled={isSubmitting}
            onClick={() => onRespond(prompt.toolCallId, 'No', prompt.id)}
          >
            Deny
          </Button>
        </div>
      </div>
    );
  }

  return <AskUserCard prompt={prompt} payload={payload} isSubmitting={isSubmitting} onRespond={onRespond} />;
}

function AskUserCard({
  prompt,
  payload,
  isSubmitting,
  onRespond,
}: {
  prompt: SuspensionPrompt;
  payload: SuspendPayloadShape;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[], promptId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const options = payload.options ?? [];
  const question = payload.question ?? 'The agent has a question';
  return (
    <div className={promptCardSuspension} role="group" aria-label="Question from the agent">
      <div className={promptTitle}>{question}</div>
      {options.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label="Answer options">
          {options.map(opt => (
            <Button
              key={opt.label}
              variant="outline"
              size="sm"
              className="justify-start"
              aria-label={opt.description ? `${opt.label}: ${opt.description}` : opt.label}
              disabled={isSubmitting}
              onClick={() => onRespond(prompt.toolCallId, opt.label, prompt.id)}
            >
              <strong>{opt.label}</strong>
              {opt.description && <span className="text-icon3"> — {opt.description}</span>}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="mt-2 flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (draft.trim()) onRespond(prompt.toolCallId, draft.trim(), prompt.id);
          }}
        >
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Your answer…"
            aria-label={question}
            disabled={isSubmitting}
            autoFocus
          />
          <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
            Reply
          </Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subagent card
// ---------------------------------------------------------------------------

function SubagentCard({ entry }: { entry: SubagentEntry }) {
  return (
    <div className="border-border1 border-l-accent5 bg-surface2 my-2 rounded-lg border border-l-4 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant={entry.done ? 'success' : 'info'}>subagent: {entry.agentType}</Badge>
        <Txt variant="ui-xs" className="text-icon3">
          {lastSegment(entry.modelId)}
        </Txt>
      </div>
      <Txt variant="ui-sm" className="py-1">
        {entry.task}
      </Txt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification cards
// ---------------------------------------------------------------------------

function notificationUrl(entry: NotificationEntry): string | undefined {
  const targetUrl = entry.metadata?.targetUrl;
  if (typeof targetUrl === 'string' && /^https:\/\/github\.com\//.test(targetUrl)) return targetUrl;

  const repository = entry.metadata?.repository;
  if (typeof repository !== 'string' || !/^[^/]+\/[^/]+$/.test(repository)) return undefined;
  const pullRequestNumber = entry.metadata?.pullRequestNumber;
  if (typeof pullRequestNumber === 'number') return `https://github.com/${repository}/pull/${pullRequestNumber}`;
  const issueNumber = entry.metadata?.issueNumber;
  if (typeof issueNumber === 'number') return `https://github.com/${repository}/issues/${issueNumber}`;
  return undefined;
}

function notificationPresentation(entry: NotificationEntry): { state: string; icon: ReactNode; className?: string } {
  const action = entry.metadata?.action;
  if (entry.notifKind === 'pull-request-merged') {
    return { state: 'merged', icon: <PullRequestStatusIcon status="merged" size={13} decorative /> };
  }
  if (entry.notifKind === 'pull-request-closed') {
    return { state: 'closed', icon: <PullRequestStatusIcon status="closed" size={13} decorative /> };
  }
  if (action === 'opened' || action === 'reopened') {
    return { state: 'open', icon: <CircleDot size={13} />, className: 'text-accent1' };
  }
  return { state: 'notification', icon: <Bell size={13} />, className: 'text-warning1' };
}

/** Collapsible row mirroring the ToolCard shape: chevron + label + preview + state icon. */
function NotificationRow({
  state,
  label,
  message,
  icon,
  url,
}: {
  state: string;
  label: string;
  message: string;
  icon: ReactNode;
  url?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      data-notification-state={state}
      role="group"
      aria-label={`Notification: ${label}`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow icon={icon} label={label} detail={truncate(message, 72)} expanded={expanded} />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={cn(ROW_RAIL, 'flex flex-col gap-2')}>
          <Txt variant="ui-sm">{message}</Txt>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open notification target: ${message}`}
              className="text-ui-xs text-icon3 hover:text-icon5 flex w-fit items-center gap-1"
            >
              Open on GitHub
              <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NotificationCard({ entry }: { entry: NotificationEntry }) {
  const presentation = notificationPresentation(entry);
  return (
    <NotificationRow
      state={presentation.state}
      label={entry.source ?? 'notification'}
      message={entry.message}
      icon={<span className={cn('flex items-center', presentation.className)}>{presentation.icon}</span>}
      url={notificationUrl(entry)}
    />
  );
}

function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <NotificationRow
      state="summary"
      label="Notification summary"
      message={entry.message}
      icon={<Bell size={13} className="text-warning1" />}
    />
  );
}

/** A gap reads `1 hour 58 minutes later — 08/11/2026, 5:21 PM GMT+2`; the phrase is the signal, the stamp is detail. */
function TimeGap({ text }: { text: string }) {
  const [phrase, timestamp] = text.split(' — ');
  if (!phrase) return null;

  return (
    <div className="flex items-center gap-3 py-3" role="separator" aria-label={text}>
      <span aria-hidden className="bg-border1 h-px flex-1" />
      <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0" title={timestamp}>
        {phrase}
      </Txt>
      <span aria-hidden className="bg-border1 h-px flex-1" />
    </div>
  );
}

const SIGNAL_ICONS: Record<string, ReactNode> = {
  state: <Layers size={13} className="text-purple-400" />,
  reminder: <Info size={13} className="text-accent3" />,
};

/** Compact row for state/reminder/reactive signals, collapsible when it has details. */
function SignalRow({ kind, label, message }: { kind: string; label: string; message: string }) {
  const [expanded, setExpanded] = useState(false);
  const icon = SIGNAL_ICONS[kind] ?? <Info size={13} className="text-icon3" />;

  if (!message) {
    return (
      <div className="max-w-full min-w-0" data-signal-kind={kind} role="group" aria-label={`Signal: ${label}`}>
        <TranscriptRow icon={icon} label={label} />
      </div>
    );
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      data-signal-kind={kind}
      role="group"
      aria-label={`Signal: ${label}`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow icon={icon} label={label} detail={truncate(message, 72)} expanded={expanded} />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={ROW_RAIL}>
          <Txt variant="ui-sm" className="break-words whitespace-pre-wrap">
            {message}
          </Txt>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

interface PreparedTranscriptEntry {
  entry: TimelineEntry;
  content: ReactNode;
}

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
  const approveMutation = useApproveAgentControllerToolMutation(hookArgs);
  const respondMutation = useRespondAgentControllerSuspensionMutation(hookArgs);

  const onApprove = async (toolCallId: string, approved: boolean, promptId: string) => {
    await approveMutation.mutateAsync({ toolCallId, approved });
    resolvePrompt(promptId);
  };
  const onRespond = async (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => {
    await respondMutation.mutateAsync({ toolCallId, resumeData });
    resolvePrompt(promptId);
  };

  return (
    <TranscriptEntries
      entries={transcript.entries}
      restoredHistory
      isSubmitting={approveMutation.isPending || respondMutation.isPending}
      onApprove={onApprove}
      onRespond={onRespond}
      running={busy}
      tail={tail}
    />
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
  const suspensions = new Map(
    entries.flatMap(entry => (entry.kind === 'suspension' ? [[entry.toolCallId, entry] as const] : [])),
  );
  const canonicalToolCallIds = new Set(
    entries.flatMap(entry =>
      entry.kind === 'message'
        ? entry.message.content.parts.flatMap(part =>
            part.type === 'tool-invocation' ? [part.toolInvocation.toolCallId] : [],
          )
        : [],
    ),
  );
  const renderEntry = (entry: TimelineEntry): ReactNode => {
    switch (entry.kind) {
      case 'message':
        return renderMessageBubble({ entry, suspensions, isSubmitting, onRespond });
      case 'notice':
        return <NoticeCard entry={entry} />;
      case 'approval':
        return <ApprovalCard prompt={entry} isSubmitting={isSubmitting} onApprove={onApprove} />;
      case 'notification':
        return <NotificationCard entry={entry} />;
      case 'notification_summary':
        return <NotificationSummaryCard entry={entry} />;
      case 'suspension':
        return entry.toolName === 'request_access' || !canonicalToolCallIds.has(entry.toolCallId) ? (
          <SuspensionCard prompt={entry} isSubmitting={isSubmitting} onRespond={onRespond} />
        ) : null;
      case 'subagent':
        return <SubagentCard entry={entry} />;
      default:
        return null;
    }
  };

  const preparedEntries = entries.map(entry => ({ entry, content: renderEntry(entry) }));

  // Ignore echoed user signals that render nothing when opening a turn.
  const drawsContent = (entry: MessageEntry): boolean =>
    entry.message.content.parts.some(part => isRenderablePart(part, suspensions, entry.runtimeTools));
  const opensTurn = (entry: TimelineEntry): boolean =>
    entry.kind === 'message' && startsUserTurn(entry.message) && drawsContent(entry);

  const turnGroups: { key: string; entries: PreparedTranscriptEntry[]; opensTurn: boolean }[] = [];
  for (const preparedEntry of preparedEntries) {
    const opens = opensTurn(preparedEntry.entry);
    if (!opens && turnGroups.length > 0) {
      turnGroups.at(-1)?.entries.push(preparedEntry);
      continue;
    }
    // A gap sorts above the turn it introduces but arrives after it: inside that turn the
    // room absorbs its height, outside it shifts the transcript a beat later.
    const previous = turnGroups.at(-1);
    const introduction = previous && isTimeGap(previous.entries.at(-1)?.entry) ? previous.entries.splice(-1) : [];
    turnGroups.push({
      key: preparedEntry.entry.id,
      entries: [...introduction, preparedEntry],
      opensTurn: opens,
    });
  }
  const [restoredTurnKey] = useState(() => (restoredHistory ? turnGroups.at(-1)?.key : undefined));

  return (
    <>
      {turnGroups.map((group, index) => {
        const isLiveTurn = index === turnGroups.length - 1;
        // Closing turns keep their room class so reserved space releases through its transition.
        const holdsRoom = isLiveTurn && group.opensTurn && running;
        const openRoomClass = group.key === restoredTurnKey ? 'turn-room-restored-open' : 'turn-room-open';

        return (
          <div
            key={group.key}
            className={cn('flex flex-col', group.opensTurn && 'turn-room', holdsRoom && openRoomClass)}
          >
            {group.entries.map(({ entry, content }) => (
              <MessageScrollerItem
                key={entry.id}
                messageId={entry.id}
                scrollAnchor={opensTurn(entry)}
                // Prepend anchoring needs real item heights, not off-screen estimates.
                className="[content-visibility:visible]"
              >
                {content}
              </MessageScrollerItem>
            ))}
            {isLiveTurn && tail}
          </div>
        );
      })}
      {turnGroups.length === 0 && tail}
    </>
  );
}

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
      {origin.platform === 'slack' && <Slack className="size-3" aria-hidden="true" />}
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
function renderMessageBubble({
  entry,
  suspensions,
  isSubmitting,
  onRespond,
}: {
  entry: MessageEntry;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  const messageParts = entry.message.content.parts ?? [];

  const parts = messageParts.filter(part => isRenderablePart(part, suspensions, entry.runtimeTools));
  const message =
    parts.length === messageParts.length
      ? entry.message
      : { ...entry.message, content: { ...entry.message.content, parts } };
  const hasRenderablePart = parts.length > 0;

  const toolGroups = collectToolGroups(parts, suspensions, entry.runtimeTools);
  const origin = channelOrigin(entry);
  const prose = messageText(parts);
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
        {prose ? <MessageMeta text={prose} createdAt={entry.message.createdAt} align="end" /> : null}
      </div>
    ),
    Assistant: ({ children }) => (
      // The trailing margin of the last part spaced this message from the next
      // entry; the meta row inherits it as a gap unless it moves to the wrapper.
      <div className={cn(MESSAGE_HOVER, 'max-w-full', prose && 'mb-3 [&>*:nth-last-child(2)]:mb-0')}>
        {children}
        {prose ? <MessageMeta text={prose} createdAt={entry.message.createdAt} align="start" /> : null}
      </div>
    ),
    System: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
    Signal: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
  };

  const renderers = {
    Text: (part: TextPart) => {
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
      <div className="border-border1 my-1.5 border-l-2 pl-2.5 italic [&_p]:my-0.5">
        <MarkdownRenderer className="text-ui-sm text-icon3">{part.reasoning}</MarkdownRenderer>
      </div>
    ),
    ToolInvocation: (part: ToolInvocationPart) => {
      const toolCallId = part.toolInvocation.toolCallId;
      const group = toolGroups.byFirstId.get(toolCallId);
      if (group) return <ToolGroup tools={group} />;
      if (toolGroups.memberIds.has(toolCallId)) return null;

      const runtime = entry.runtimeTools?.[toolCallId];
      const tool = toolFromInvocationPart(part, runtime);
      const suspension = suspensions.get(tool.toolCallId);
      return (
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
      );
    },
    File: (part: FilePart) => <FileAttachment part={part} />,
  };

  const skillActivation =
    entry.message.role === 'user' && parts.length === 1 && parts[0].type === 'text'
      ? parseSkillActivation(parts[0].text)
      : undefined;
  if (skillActivation) return <SkillMessage activation={skillActivation} />;
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

/** Terminal status carried by the persisted part, if it reached one. */
function terminalInvocationStatus(invocation: ToolInvocationPart['toolInvocation']): 'done' | 'error' | undefined {
  if (!isTerminalInvocationState(invocation.state)) return undefined;
  if (invocation.state !== 'result') return 'error';
  return 'isError' in invocation && invocation.isError === true ? 'error' : 'done';
}

/** Parts that draw something: step markers and blank prose leave empty bubbles and split runs of calls. */
function isRenderablePart(
  part: MessageEntry['message']['content']['parts'][number],
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): boolean {
  switch (part.type) {
    case 'text':
      return part.text.trim().length > 0;
    case 'reasoning':
      return part.reasoning.trim().length > 0;
    case 'tool-invocation':
      return isRenderableTool(part, suspensions, runtimeTools);
    case 'file':
      return true;
    default:
      return false;
  }
}

function isRenderableTool(
  part: ToolInvocationPart,
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): boolean {
  const tool = toolFromInvocationPart(part, runtimeTools?.[part.toolInvocation.toolCallId]);
  if (!isTranscriptToolVisible(tool.toolName)) return false;

  const awaitingPrompt = tool.toolName === 'ask_user' && tool.status === 'running' && !suspensions.has(tool.toolCallId);
  return !awaitingPrompt;
}

/** Tools whose own card carries the turn: a group row would swallow the prompt, the plan or the skill instructions. */
const UNGROUPABLE_TOOLS = new Set(['ask_user', 'submit_plan', 'skill']);

/**
 * Collapse runs of {@link TOOL_GROUP_MIN}+ consecutive plain tool calls into
 * groups keyed by their first toolCallId. Suspended calls break a run too —
 * their prompt must render inline.
 */
function collectToolGroups(
  parts: MessageEntry['message']['content']['parts'],
  suspensions: ReadonlyMap<string, SuspensionPrompt>,
  runtimeTools: MessageEntry['runtimeTools'],
): { byFirstId: Map<string, ToolCall[]>; memberIds: Set<string> } {
  const byFirstId = new Map<string, ToolCall[]>();
  const memberIds = new Set<string>();
  let run: ToolCall[] = [];

  const flush = () => {
    if (run.length >= TOOL_GROUP_MIN) {
      byFirstId.set(run[0].toolCallId, run);
      for (const tool of run.slice(1)) memberIds.add(tool.toolCallId);
    }
    run = [];
  };

  for (const part of parts) {
    const groupable =
      part.type === 'tool-invocation' &&
      !UNGROUPABLE_TOOLS.has(part.toolInvocation.toolName) &&
      !suspensions.has(part.toolInvocation.toolCallId);
    if (groupable) {
      run.push(toolFromInvocationPart(part, runtimeTools?.[part.toolInvocation.toolCallId]));
    } else {
      flush();
    }
  }
  flush();

  return { byFirstId, memberIds };
}

function toolFromInvocationPart(part: ToolInvocationPart, runtime?: ToolCall): ToolCall {
  const invocation = part.toolInvocation;
  const persistedResult = 'result' in invocation ? invocation.result : undefined;
  // Persisted terminal state beats the live overlay: `tool_end` can be lost in
  // an SSE gap (no server replay), and a terminal part never regresses — the
  // overlay's 'running' would otherwise spin forever.
  const terminalStatus = terminalInvocationStatus(invocation);
  const result = terminalStatus
    ? (persistedResult ?? invocation.errorText ?? runtime?.result)
    : (runtime?.result ?? persistedResult ?? invocation.errorText);
  return {
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName,
    argsText: runtime?.argsText ?? '',
    args: runtime?.args ?? ('args' in invocation ? invocation.args : undefined),
    status: terminalStatus ?? runtime?.status ?? 'running',
    result,
    output: runtime?.output ?? '',
  };
}

function notificationMetadata(entry: MessageEntry): Array<NotificationEntry | NotificationSummaryEntry> {
  if (entry.message.role === 'signal') return signalNotifications(entry);

  const harnessContent = entry.message.content.metadata?.harnessContent;
  if (!Array.isArray(harnessContent)) return [];

  const notifications: Array<NotificationEntry | NotificationSummaryEntry> = [];
  for (const [index, part] of harnessContent.entries()) {
    if (typeof part !== 'object' || part === null || !('type' in part)) continue;
    if (!('message' in part) || typeof part.message !== 'string') continue;

    if (part.type === 'notification') {
      notifications.push({
        kind: 'notification',
        id: `${entry.id}-notification-${index}`,
        notificationId:
          'notificationId' in part && typeof part.notificationId === 'string' ? part.notificationId : undefined,
        message: part.message,
        source: 'source' in part && typeof part.source === 'string' ? part.source : undefined,
        notifKind: 'kind' in part && typeof part.kind === 'string' ? part.kind : undefined,
        priority: 'priority' in part && typeof part.priority === 'string' ? part.priority : undefined,
        metadata: 'metadata' in part && isRecord(part.metadata) ? part.metadata : undefined,
      });
      continue;
    }

    if (part.type !== 'notification_summary') continue;
    const pending = 'pending' in part && typeof part.pending === 'number' ? part.pending : 0;
    const bySource = 'bySource' in part && isNumberRecord(part.bySource) ? part.bySource : {};
    const byPriority = 'byPriority' in part && isNumberRecord(part.byPriority) ? part.byPriority : {};
    const notificationIds =
      'notificationIds' in part && Array.isArray(part.notificationIds)
        ? part.notificationIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];
    notifications.push({
      kind: 'notification_summary',
      id: `${entry.id}-notification-summary-${index}`,
      message: part.message,
      pending,
      bySource,
      byPriority,
      notificationIds,
    });
  }
  return notifications;
}

/**
 * Persisted notification signals are DB-native `role: 'signal'` rows whose
 * original signal payload lives under `content.metadata.signal` (see
 * `signalToDBMessage` in @mastra/core). Rebuild notification cards from it so
 * they survive transcript hydration.
 */
function isSkillNotificationSignal(entry: MessageEntry): boolean {
  if (entry.message.role !== 'signal') return false;
  const signal = entry.message.content.metadata?.signal;
  return isRecord(signal) && signal.type === 'notification' && Boolean(parseSkillActivation(signalPartsText(entry)));
}

function signalNotifications(entry: MessageEntry): Array<NotificationEntry | NotificationSummaryEntry> {
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || signal.type !== 'notification') return [];
  if (isSkillNotificationSignal(entry)) return [];

  const text = signalPartsText(entry);
  const attributes = isRecord(signal.attributes) ? signal.attributes : {};
  const metadata = isRecord(signal.metadata) ? signal.metadata : {};

  if (signal.tagName === 'notification-summary') {
    const summary = isRecord(metadata.notificationSummary) ? metadata.notificationSummary : {};
    return [
      {
        kind: 'notification_summary',
        id: `${entry.id}-signal-summary`,
        message: text,
        pending: typeof summary.pending === 'number' ? summary.pending : 0,
        bySource: isNumberRecord(summary.bySource) ? summary.bySource : {},
        byPriority: isNumberRecord(summary.byPriority) ? summary.byPriority : {},
        notificationIds: Array.isArray(summary.notificationIds)
          ? summary.notificationIds.filter((id: unknown): id is string => typeof id === 'string')
          : [],
      },
    ];
  }

  return [
    {
      kind: 'notification',
      id: `${entry.id}-signal-notification`,
      notificationId: typeof attributes.id === 'string' ? attributes.id : undefined,
      message: text,
      source: typeof attributes.source === 'string' ? attributes.source : undefined,
      notifKind: typeof attributes.kind === 'string' ? attributes.kind : undefined,
      priority: typeof attributes.priority === 'string' ? attributes.priority : undefined,
      metadata,
    },
  ];
}

function signalPartsText(entry: MessageEntry): string {
  const { contents } = mastraDBMessageToSignal(entry.message);
  if (typeof contents === 'string') return contents.trim();

  return contents
    .flatMap(part => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n')
    .trim();
}

// Internal control-plane signals handled by GithubSignals; the user-visible
// result is rendered elsewhere, so showing these would duplicate the UI.
const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
// State snapshots already surfaced by the pinned task list and GoalPanel.
const SUPPRESSED_STATE_SIGNAL_IDS = new Set(['tasks', 'goal']);

type SignalRowView =
  | { kind: 'state'; stateId: string; mode: 'snapshot' | 'delta'; text: string }
  | { kind: 'gap'; text: string }
  | { kind: 'reminder'; text: string }
  | { kind: 'reactive'; tagName?: string; text: string };

/**
 * Classify non-notification `role: 'signal'` messages into the row they drive,
 * mirroring the TUI's `getSignalKind` dispatch (state -> reminder -> reactive).
 * Notification signals are rebuilt by `signalNotifications`, and user signals
 * are reclassified to `role: 'user'` in the reducer, so both return undefined.
 */
function signalRowView(entry: MessageEntry): SignalRowView | undefined {
  if (entry.message.role !== 'signal') return undefined;
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal)) return undefined;

  const tagName = typeof signal.tagName === 'string' ? signal.tagName : undefined;
  const text = signalPartsText(entry);
  const attributes = isRecord(signal.attributes) ? signal.attributes : {};
  const reminderKind = attributes.type === 'temporal-gap' ? 'gap' : 'reminder';

  if (signal.type === 'state') {
    const metadata = isRecord(signal.metadata) ? signal.metadata : {};
    const stateMeta = isRecord(metadata.state) ? metadata.state : {};
    return {
      kind: 'state',
      stateId: (typeof stateMeta.id === 'string' ? stateMeta.id : undefined) ?? tagName ?? 'state',
      mode: stateMeta.mode === 'delta' ? 'delta' : 'snapshot',
      text,
    };
  }
  // `normalizeSignal` maps `system-reminder` to `reactive` + `system-reminder`
  // tag before persistence, but live pre-normalized signals may carry the raw type.
  if (signal.type === 'system-reminder') return { kind: reminderKind, text };
  if (signal.type === 'reactive' && tagName === 'system-reminder') return { kind: reminderKind, text };
  if (signal.type === 'reactive') return { kind: 'reactive', tagName, text };
  return undefined;
}

/** The `24 minutes later` separator, written a millisecond before the turn it introduces. */
function isTimeGap(entry: TimelineEntry | undefined): boolean {
  return entry?.kind === 'message' && signalRowView(entry)?.kind === 'gap';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(candidate => typeof candidate === 'number')
  );
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

function NoticeCard({ entry }: { entry: NoticeEntry }) {
  return (
    <Notice className="my-2" variant={entry.level === 'error' ? 'destructive' : 'info'}>
      <MarkdownRenderer className="text-current">{entry.text}</MarkdownRenderer>
    </Notice>
  );
}
