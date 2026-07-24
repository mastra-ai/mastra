import type { PlanResume } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeBlock as DsCodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageFactory } from '@mastra/react';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  CircleDot,
  CircleX,
  ExternalLink,
  GitMerge,
  Info,
  Layers,
  Slack,
  Wrench,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { highlightCode, languageForPath } from '../../../ui/highlight';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useApproveAgentControllerToolMutation,
  useRespondAgentControllerSuspensionMutation,
} from '../../../../../shared/hooks/useAgentControllerRunMutations';
import { stripSerializedAnsi } from '../services/ansi';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { isTranscriptToolVisible, ToolFactory } from './ToolFactory';
import { Markdown } from '../../../ui/Markdown';

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

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? id;
}

interface SkillActivation {
  name: string;
  content: string;
  arguments?: string;
}

const skillActivationPattern = /^<skill name="([a-z0-9]+(?:-[a-z0-9]+)*)">\n([\s\S]+)\n<\/skill>$/;
const skillArgumentsMarker = '\n\nARGUMENTS: ';

function parseSkillActivation(text: string): SkillActivation | undefined {
  const match = skillActivationPattern.exec(text.trim());
  if (!match) return undefined;

  const content = match[2];
  const argumentsIndex = content.lastIndexOf(skillArgumentsMarker);
  return {
    name: match[1],
    content,
    arguments: argumentsIndex >= 0 ? content.slice(argumentsIndex + skillArgumentsMarker.length).trim() : undefined,
  };
}

function SkillActivationCard({ activation }: { activation: SkillActivation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="min-w-64 max-w-full">
      <CollapsibleTrigger
        className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1"
        aria-label={`${expanded ? 'Hide' : 'Show'} ${activation.name} skill contents`}
      >
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-icon3">
            <BookOpen size={14} aria-hidden="true" />
            <Txt as="span" variant="ui-xs" className="uppercase tracking-wide">
              Skill
            </Txt>
          </span>
          <Txt as="span" variant="ui-sm" font="mono" className="text-icon6">
            {activation.name}
          </Txt>
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`ml-auto shrink-0 text-icon3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </span>
        {activation.arguments && (
          <span className="mt-1 block truncate text-ui-xs text-icon3">{activation.arguments}</span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 max-h-96 overflow-y-auto border-t border-border1 pt-2">
        <div className="prose text-ui-sm">
          <Markdown>{activation.content}</Markdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Tool card (collapsible)
// ---------------------------------------------------------------------------

/** Quiet status indicator: muted spinner while running, red cross on failure, nothing on success. */
function ToolStatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'running') return <Spinner size="sm" aria-label="Running" className="size-3.5 text-icon3" />;
  if (status === 'error') return <X size={14} role="img" aria-label="Failed" className="text-error" />;
  return null;
}

/** Label + copy header for a section inside a tool card body. */
function ToolSection({ label, copyText, children }: { label: string; copyText: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          {label}
        </Txt>
        <CopyButton content={copyText} size="sm" variant="ghost" />
      </div>
      {children}
    </div>
  );
}

/** A unified-diff-style view of an edit's before/after text, syntax-highlighted. */
function DiffView({ oldText, newText, path }: { oldText: string; newText: string; path?: string }) {
  const lang = languageForPath(path);
  const removed = oldText.split('\n');
  const added = newText.split('\n');
  return (
    <div
      className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-border1 bg-surface1 font-mono text-xs leading-normal"
      role="group"
      aria-label="File change"
    >
      {removed.map((line, i) => (
        <div key={`r${i}`} className="flex whitespace-pre bg-error/10">
          <span className="w-5 shrink-0 select-none text-center text-error opacity-70">-</span>
          <span
            className="flex-1 pr-2.5 text-icon6 [&_span]:font-inherit [&_span]:text-inherit [&_span]:leading-inherit dark:[&_span]:![color:var(--shiki-dark)] dark:[&_span]:![background-color:var(--shiki-dark-bg)]"
            dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || '&nbsp;' }}
          />
        </div>
      ))}
      {added.map((line, i) => (
        <div key={`a${i}`} className="flex whitespace-pre bg-accent1/10">
          <span className="w-5 shrink-0 select-none text-center text-accent1 opacity-70">+</span>
          <span
            className="flex-1 pr-2.5 text-icon6 [&_span]:font-inherit [&_span]:text-inherit [&_span]:leading-inherit dark:[&_span]:![color:var(--shiki-dark)] dark:[&_span]:![background-color:var(--shiki-dark-bg)]"
            dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || '&nbsp;' }}
          />
        </div>
      ))}
    </div>
  );
}

interface EditArgs {
  path?: string;
  old_string?: string;
  new_string?: string;
  content?: string;
}

function hasProperty<K extends string>(value: object, key: K): value is object & Record<K, unknown> {
  return key in value;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !hasProperty(value, key)) return undefined;
  return typeof value[key] === 'string' ? value[key] : undefined;
}

/** Detect edit-style tools whose args are better shown as a diff/code block. */
function editArgs(toolName: string, args: unknown): EditArgs | undefined {
  const edit = {
    path: stringProperty(args, 'path'),
    old_string: stringProperty(args, 'old_string'),
    new_string: stringProperty(args, 'new_string'),
    content: stringProperty(args, 'content'),
  };
  const isReplace = /string_replace|str_replace/i.test(toolName) && edit.new_string !== undefined;
  const isWrite = /write_file|create_file/i.test(toolName) && edit.content !== undefined;
  return isReplace || isWrite ? edit : undefined;
}

function ToolCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const argsPreview = tool.args !== undefined ? JSON.stringify(tool.args) : tool.argsText;
  const argsPretty = tool.args !== undefined ? stringify(tool.args) : tool.argsText;
  const resultText =
    tool.status !== 'running' && tool.result !== undefined ? stripSerializedAnsi(stringify(tool.result)) : undefined;
  const edit = editArgs(tool.toolName, tool.args);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="min-w-0 max-w-full"
      role="group"
      aria-label={`Tool: ${tool.toolName}`}
    >
      {/*
        Wrap the trigger content in a span so the chevron is not a *direct*
        child of CollapsibleTrigger — the DS trigger rotates direct-child <svg>
        via `[&>svg]:rotate-90` on open. Nesting keeps the chevron controlled
        here.
      */}
      <CollapsibleTrigger className="w-full rounded-lg text-left transition-colors hover:bg-surface2 active:bg-surface4">
        <span className="flex w-full items-center gap-2 px-2 py-1.5">
          <ChevronDown
            size={13}
            className={cn(
              'shrink-0 text-icon3 transition-transform duration-150',
              expanded ? 'rotate-0' : '-rotate-90',
            )}
          />
          <span className="flex shrink-0 items-center">
            <Wrench size={13} className="text-icon3" />
          </span>
          <Txt as="span" variant="ui-smd" className="text-icon5">
            {tool.toolName}
          </Txt>
          {edit?.path && (
            <Txt as="span" variant="ui-xs" font="mono" className="truncate text-icon3">
              {edit.path}
            </Txt>
          )}
          {!edit && argsPreview && (
            <Txt as="span" variant="ui-xs" font="mono" className="truncate text-icon3">
              {truncate(argsPreview, 72)}
            </Txt>
          )}
          <span className="ml-auto flex shrink-0 items-center">
            <ToolStatusIcon status={tool.status} />
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 max-w-full">
        <div className="mt-1 flex min-w-0 max-w-full flex-col gap-2 rounded-2xl border border-border1 bg-surface2 p-2">
          {edit ? (
            edit.new_string !== undefined ? (
              <ToolSection label={edit.path ?? 'Change'} copyText={edit.new_string}>
                <DiffView oldText={edit.old_string ?? ''} newText={edit.new_string} path={edit.path} />
              </ToolSection>
            ) : (
              <DsCodeBlock
                code={truncate(edit.content ?? '', 2000)}
                lang={languageForPath(edit.path)}
                fileName={edit.path ?? 'Change'}
                overflow="scroll"
              />
            )
          ) : argsPretty ? (
            <DsCodeBlock code={argsPretty} lang="json" fileName="Arguments" />
          ) : null}
          {tool.output && (
            <ToolSection label="Output" copyText={tool.output}>
              <pre className="m-0 max-h-72 max-w-full overflow-auto whitespace-pre rounded-xl bg-surface1 px-3 py-2 font-mono text-xs leading-normal text-icon3">
                {tool.output}
              </pre>
            </ToolSection>
          )}
          {resultText !== undefined && <DsCodeBlock code={truncate(resultText, 800)} lang="json" fileName="Result" />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
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
        Approve <code className="rounded bg-surface5 px-1.5 py-px font-mono text-xs">{prompt.toolName}</code>?
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
      <div className={promptCardSuspension} role="group" aria-label="Plan approval">
        <div className={promptTitle}>Plan: {payload.plan?.title ?? payload.title ?? 'Proposed plan'}</div>
        {payload.plan?.summary && (
          <div className="whitespace-pre-wrap break-words font-mono text-ui-smd leading-relaxed text-icon5">
            {payload.plan.summary}
          </div>
        )}
        <div className={promptActions}>
          <Button
            variant="primary"
            size="sm"
            aria-label="Approve the plan and switch to build"
            autoFocus
            disabled={isSubmitting}
            onClick={() => onRespond(prompt.toolCallId, { action: 'approved' }, prompt.id)}
          >
            Approve &amp; build
          </Button>
          <Button
            size="sm"
            aria-label="Reject the plan"
            disabled={isSubmitting}
            onClick={() => onRespond(prompt.toolCallId, { action: 'rejected' }, prompt.id)}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  }

  if (prompt.toolName === 'request_access') {
    return (
      <div className={promptCardSuspension} role="group" aria-label="Access request">
        <div className={promptTitle}>Grant access to {payload.requestedPath ?? 'a path'}?</div>
        {payload.reason && <div className="mt-0.5 text-xs text-icon3">Reason: {payload.reason}</div>}
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
    <div className="my-2 rounded-lg border border-l-4 border-border1 border-l-accent5 bg-surface2 px-3 py-2 shadow-sm">
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

function notificationPresentation(entry: NotificationEntry) {
  const action = entry.metadata?.action;
  if (entry.notifKind === 'pull-request-merged') {
    return { state: 'merged', icon: <GitMerge size={13} />, className: 'text-accent3' };
  }
  if (entry.notifKind === 'pull-request-closed') {
    return { state: 'closed', icon: <CircleX size={13} />, className: 'text-error' };
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
      className="min-w-0 max-w-full"
      data-notification-state={state}
      role="group"
      aria-label={`Notification: ${label}`}
    >
      <CollapsibleTrigger className="w-full rounded-lg text-left transition-colors hover:bg-surface2 active:bg-surface4">
        <span className="flex w-full items-center gap-2 px-2 py-1.5">
          <ChevronDown
            size={13}
            className={cn(
              'shrink-0 text-icon3 transition-transform duration-150',
              expanded ? 'rotate-0' : '-rotate-90',
            )}
          />
          <span className="flex shrink-0 items-center">{icon}</span>
          <Txt as="span" variant="ui-smd" className="shrink-0 text-icon5">
            {label}
          </Txt>
          <Txt as="span" variant="ui-xs" font="mono" className="truncate text-icon3">
            {truncate(message, 72)}
          </Txt>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 max-w-full">
        <div className="mt-1 flex min-w-0 max-w-full flex-col gap-2 rounded-2xl border border-border1 bg-surface2 p-2">
          <Txt variant="ui-sm">{message}</Txt>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open notification target: ${message}`}
              className="flex w-fit items-center gap-1 text-ui-xs text-icon3 hover:text-icon5"
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

/** Collapsible row for state/reminder/reactive signals, mirroring NotificationRow. */
function SignalRow({ kind, label, message }: { kind: string; label: string; message: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="min-w-0 max-w-full"
      data-signal-kind={kind}
      role="group"
      aria-label={`Signal: ${label}`}
    >
      <CollapsibleTrigger className="w-full rounded-lg text-left transition-colors hover:bg-surface2 active:bg-surface4">
        <span className="flex w-full items-center gap-2 px-2 py-1.5">
          <ChevronDown
            size={13}
            className={cn(
              'shrink-0 text-icon3 transition-transform duration-150',
              expanded ? 'rotate-0' : '-rotate-90',
            )}
          />
          <span className="flex shrink-0 items-center">
            {kind === 'state' ? (
              <Layers size={13} className="text-purple-400" />
            ) : kind === 'reminder' ? (
              <Info size={13} className="text-accent3" />
            ) : (
              <Info size={13} className="text-icon3" />
            )}
          </span>
          <Txt as="span" variant="ui-smd" className="shrink-0 text-icon5">
            {label}
          </Txt>
          <Txt as="span" variant="ui-xs" font="mono" className="truncate text-icon3">
            {truncate(message, 72)}
          </Txt>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 max-w-full">
        <div className="mt-1 min-w-0 max-w-full rounded-2xl border border-border1 bg-surface2 p-2">
          <Txt variant="ui-sm" className="whitespace-pre-wrap break-words">
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

export function Transcript() {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { transcript, resolvePrompt } = useChatTranscript();
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
      isSubmitting={approveMutation.isPending || respondMutation.isPending}
      onApprove={onApprove}
      onRespond={onRespond}
    />
  );
}

export function TranscriptEntries({
  entries,
  isSubmitting = false,
  onApprove,
  onRespond,
}: {
  entries: TimelineEntry[];
  isSubmitting?: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
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

  return (
    <>
      {entries.map(entry => {
        switch (entry.kind) {
          case 'message':
            return (
              <MessageBubble
                key={entry.id}
                entry={entry}
                suspensions={suspensions}
                isSubmitting={isSubmitting}
                onRespond={onRespond}
              />
            );
          case 'notice':
            return <NoticeCard key={entry.id} entry={entry} />;
          case 'approval':
            return <ApprovalCard key={entry.id} prompt={entry} isSubmitting={isSubmitting} onApprove={onApprove} />;
          case 'notification':
            return <NotificationCard key={entry.id} entry={entry} />;
          case 'notification_summary':
            return <NotificationSummaryCard key={entry.id} entry={entry} />;
          case 'suspension':
            return entry.toolName === 'request_access' || !canonicalToolCallIds.has(entry.toolCallId) ? (
              <SuspensionCard key={entry.id} prompt={entry} isSubmitting={isSubmitting} onRespond={onRespond} />
            ) : null;
          case 'subagent':
            return <SubagentCard key={entry.id} entry={entry} />;
          default:
            return null;
        }
      })}
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
    <div className="mt-1 flex items-center gap-1 text-ui-xs text-icon3" aria-label={`Sent from ${label}`}>
      {origin.platform === 'slack' && <Slack className="size-3" aria-hidden="true" />}
      <span>
        via {label}
        {origin.authorName ? ` · ${origin.authorName}` : ''}
      </span>
    </div>
  );
}

function MessageBubble({
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
  const parts = messageParts.filter(
    part => part.type !== 'tool-invocation' || isTranscriptToolVisible(part.toolInvocation.toolName),
  );
  const message =
    parts.length === messageParts.length
      ? entry.message
      : { ...entry.message, content: { ...entry.message.content, parts } };
  const hasRenderablePart = parts.some(
    part =>
      (part.type === 'text' && part.text.trim().length > 0) ||
      (part.type === 'reasoning' && part.reasoning.trim().length > 0) ||
      part.type === 'tool-invocation' ||
      part.type === 'file',
  );

  const lastTextPart = (() => {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].type === 'text') return parts[i];
    }
    return undefined;
  })();

  const origin = channelOrigin(entry);
  const roles: MessageRoleRenderers = {
    User: ({ children }) => (
      <div className="my-3 flex w-full flex-col items-end">
        <div
          className={`max-w-[70%] break-words rounded-xl px-4 py-2 text-text1 ${
            entry.steer ? 'bg-warning1/10' : 'bg-surface3'
          }`}
        >
          {children}
        </div>
        {origin && <ChannelOriginBadge origin={origin} />}
      </div>
    ),
    Assistant: ({ children }) => <div className="max-w-full">{children}</div>,
    System: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
    Signal: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
  };

  const renderers = {
    Text: (part: TextPart) => {
      if (entry.message.role === 'user') {
        const activation = parseSkillActivation(part.text);
        return activation ? (
          <SkillActivationCard activation={activation} />
        ) : (
          <div className="prose">
            <Markdown>{part.text}</Markdown>
          </div>
        );
      }

      return (
        <div className="prose my-3">
          <Markdown>{part.text}</Markdown>
          {entry.streaming && part === lastTextPart && (
            <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-accent1 align-text-bottom" />
          )}
        </div>
      );
    },
    Reasoning: (part: ReasoningPart) => (
      <div className="my-1.5 border-l-2 border-border1 pl-2.5 text-ui-sm italic text-icon3 [&_p]:my-0.5">
        <Markdown>{part.reasoning}</Markdown>
      </div>
    ),
    ToolInvocation: (part: ToolInvocationPart) => {
      const runtime = entry.runtimeTools?.[part.toolInvocation.toolCallId];
      const tool = toolFromInvocationPart(part, runtime);
      const suspension = suspensions.get(tool.toolCallId);
      if (tool.toolName === 'ask_user' && tool.status === 'running' && !suspension) return null;
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
      <img src={src} alt="Attached image" className="my-1.5 max-h-80 max-w-full rounded-md border border-border1" />
    );
  }
  return <pre className={resultBlock}>{stringify(part)}</pre>;
}

function toolFromInvocationPart(part: ToolInvocationPart, runtime?: ToolCall): ToolCall {
  const invocation = part.toolInvocation;
  const failed = invocation.state === 'output-error' || invocation.state === 'output-denied';
  const persistedResult = 'result' in invocation ? invocation.result : undefined;
  return {
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName,
    argsText: runtime?.argsText ?? '',
    args: runtime?.args ?? ('args' in invocation ? invocation.args : undefined),
    status: runtime?.status ?? (failed ? 'error' : invocation.state === 'result' ? 'done' : 'running'),
    result: runtime?.result ?? persistedResult ?? invocation.errorText,
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
function signalNotifications(entry: MessageEntry): Array<NotificationEntry | NotificationSummaryEntry> {
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || signal.type !== 'notification') return [];

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
  return (entry.message.content.parts ?? [])
    .map(part => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
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
  if (signal.type === 'system-reminder') return { kind: 'reminder', text };
  if (signal.type === 'reactive' && tagName === 'system-reminder') return { kind: 'reminder', text };
  if (signal.type === 'reactive') return { kind: 'reactive', tagName, text };
  return undefined;
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
      <div className="prose">
        <Markdown>{entry.text}</Markdown>
      </div>
    </Notice>
  );
}
