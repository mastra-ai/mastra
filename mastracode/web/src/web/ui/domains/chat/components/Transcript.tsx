import type { PlanResume } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeBlock as DsCodeBlock } from '@mastra/playground-ui/components/CodeBlock';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
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
  Eye,
  GitMerge,
  Globe,
  ListChecks,
  Pencil,
  Search,
  Slack,
  Terminal,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

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

function ToolIcon({ name, size = 14, className }: { name: string; size?: number; className?: string }) {
  const n = name.toLowerCase();
  const props = { size, className };
  if (n.includes('view') || n.includes('read') || n.includes('cat')) return <Eye {...props} />;
  if (n.includes('write') || n.includes('edit') || n.includes('replace') || n.includes('str_replace'))
    return <Pencil {...props} />;
  if (n.includes('exec') || n.includes('command') || n.includes('shell') || n.includes('bash') || n.includes('run'))
    return <Terminal {...props} />;
  if (n.includes('search') || n.includes('grep') || n.includes('find') || n.includes('glob'))
    return <Search {...props} />;
  if (n.includes('task') || n.includes('todo')) return <ListChecks {...props} />;
  if (n.includes('browser') || n.includes('web') || n.includes('fetch') || n.includes('http'))
    return <Globe {...props} />;
  return <Wrench {...props} />;
}
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
const promptCardBase = 'rounded-lg border border-border1 bg-surface3 px-4 py-3 shadow-md';
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

const STATUS_LABEL: Record<ToolCall['status'], string> = {
  running: 'Running',
  done: 'Done',
  error: 'Failed',
};

const STATUS_VARIANT: Record<ToolCall['status'], 'info' | 'success' | 'error'> = {
  running: 'info',
  done: 'success',
  error: 'error',
};

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

/**
 * Position of a tool card within a run of consecutive tool cards.
 * Consecutive cards compose into a single bordered, rounded container: the
 * container border/rounding lives on the outer edges and inner boundaries
 * become dividers. `single` is a lone card (fully rounded + bordered).
 */
type ToolGroupPosition = 'single' | 'first' | 'middle' | 'last';

function toolGroupClasses(position: ToolGroupPosition): string {
  const base = 'border-x border-border1';
  switch (position) {
    case 'single':
      return `${base} border-y rounded-xl`;
    case 'first':
      return `${base} border-t rounded-t-xl`;
    case 'middle':
      // Divider between rows is the top border; no rounding.
      return `${base} border-t`;
    case 'last':
      return `${base} border-y rounded-b-xl`;
  }
}

function ToolCard({
  tool,
  forceExpanded,
  groupPosition = 'single',
}: {
  tool: ToolCall;
  forceExpanded?: boolean;
  groupPosition?: ToolGroupPosition;
}) {
  const [expanded, setExpanded] = useState(false);
  // When the parent toggles "expand/collapse all", follow that signal.
  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);
  const argsPreview = tool.args !== undefined ? JSON.stringify(tool.args) : tool.argsText;
  const argsPretty = tool.args !== undefined ? stringify(tool.args) : tool.argsText;
  const resultText =
    tool.status !== 'running' && tool.result !== undefined ? stripSerializedAnsi(stringify(tool.result)) : undefined;
  const edit = editArgs(tool.toolName, tool.args);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className={cn('min-w-0 max-w-full overflow-hidden bg-surface3', toolGroupClasses(groupPosition))}
      role="group"
      aria-label={`Tool: ${tool.toolName}`}
    >
      {/*
        Wrap the trigger content in a span so no icon is a *direct* child of
        CollapsibleTrigger. The DS trigger rotates every direct-child <svg> via
        `[&>svg]:rotate-90` on open — which would spin the tool icon (e.g. the
        eye). Nesting keeps only the chevron animating, controlled here.
      */}
      <CollapsibleTrigger className="w-full text-left">
        <span className="flex w-full items-center gap-2 px-2 py-1.5">
          <ChevronDown
            size={13}
            className={cn(
              'shrink-0 text-icon3 transition-transform duration-150',
              expanded ? 'rotate-0' : '-rotate-90',
            )}
          />
          <ToolIcon name={tool.toolName} className="shrink-0 text-icon3" />
          <Txt as="span" variant="ui-sm" font="mono" className="text-icon5">
            {tool.toolName}
          </Txt>
          {edit?.path && !expanded && (
            <Txt as="span" variant="ui-xs" font="mono" className="truncate text-icon3">
              {edit.path}
            </Txt>
          )}
          {!edit && argsPreview && !expanded && (
            <Txt as="span" variant="ui-xs" font="mono" className="truncate text-icon3">
              {truncate(argsPreview, 72)}
            </Txt>
          )}
          <Badge variant={STATUS_VARIANT[tool.status]} size="xs" className="ml-auto">
            {STATUS_LABEL[tool.status]}
          </Badge>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex min-w-0 max-w-full flex-col gap-2 px-2 pb-2">
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
      </CollapsibleContent>
      {!expanded && tool.output && (
        <pre className="mx-2 mb-2 max-h-72 max-w-full overflow-auto whitespace-pre rounded-xl bg-surface1 px-3 py-2 font-mono text-xs leading-normal text-icon3 opacity-75">
          {truncate(tool.output, 180)}
        </pre>
      )}
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
    <div className="rounded-lg border border-l-4 border-border1 border-l-accent5 bg-surface2 px-3 py-2 shadow-sm">
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
    return { state: 'merged', icon: <GitMerge size={13} />, className: 'border-accent3/30 text-accent3' };
  }
  if (entry.notifKind === 'pull-request-closed') {
    return { state: 'closed', icon: <CircleX size={13} />, className: 'border-error/30 text-error' };
  }
  if (action === 'opened' || action === 'reopened') {
    return { state: 'open', icon: <CircleDot size={13} />, className: 'border-accent1/30 text-accent1' };
  }
  return { state: 'notification', icon: <Bell size={13} />, className: 'border-accent3/30 text-icon3' };
}

function NotificationCard({ entry }: { entry: NotificationEntry }) {
  const url = notificationUrl(entry);
  const presentation = notificationPresentation(entry);
  const content = (
    <div
      data-notification-state={presentation.state}
      className={`rounded-lg border bg-surface2 px-3 py-2 shadow-sm ${presentation.className}`}
    >
      <div className="flex items-center gap-2">
        {presentation.icon}
        <Txt variant="ui-sm" font="mono">
          {entry.source ?? 'notification'}
        </Txt>
        {url && <ExternalLink size={12} className="ml-auto" aria-hidden />}
      </div>
      <Txt variant="ui-sm" className="py-1">
        {entry.message}
      </Txt>
    </div>
  );

  if (!url) return content;
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label={`Open notification target: ${entry.message}`}>
      {content}
    </a>
  );
}

function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <div className="rounded-lg border border-accent3/30 bg-surface2 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Bell size={13} />
        <Txt variant="ui-sm" font="mono">
          Notification summary
        </Txt>
      </div>
      <Txt variant="ui-sm" className="py-1">
        {entry.message}
      </Txt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export function Transcript() {
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { transcript, resolvePrompt } = useChatTranscript();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
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

function followsToolEntry(entries: TimelineEntry[], index: number): boolean {
  const current = entries[index];
  if (current?.kind !== 'message' || current.message.role !== 'assistant') return false;

  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex--) {
    const previous = entries[previousIndex];
    if (previous.kind !== 'message') return false;
    if (previous.message.role === 'user') return false;
    if (previous.message.role === 'signal') continue;

    const parts = previous.message.content.parts;
    if (parts.some(part => part.type === 'text' && part.text.trim().length > 0)) return false;
    if (parts.some(part => part.type === 'tool-invocation')) return true;
  }

  return false;
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
      {entries.map((entry, index) => {
        switch (entry.kind) {
          case 'message':
            return (
              <MessageBubble
                key={entry.id}
                entry={entry}
                followsToolEntry={followsToolEntry(entries, index)}
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
    typeof author?.fullName === 'string' ? author.fullName : typeof author?.userName === 'string' ? author.userName : undefined;
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
  followsToolEntry,
  suspensions,
  isSubmitting,
  onRespond,
}: {
  entry: MessageEntry;
  followsToolEntry: boolean;
  suspensions: ReadonlyMap<string, SuspensionPrompt>;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  // null = no group override; true/false = expand/collapse all in this bubble.
  const [allExpanded, setAllExpanded] = useState<boolean | undefined>(undefined);
  const messageParts = entry.message.content.parts ?? [];
  const parts = messageParts.filter(
    part => part.type !== 'tool-invocation' || isTranscriptToolVisible(part.toolInvocation.toolName),
  );
  const message =
    parts.length === messageParts.length
      ? entry.message
      : { ...entry.message, content: { ...entry.message.content, parts } };
  const toolCount = parts.reduce((n, part) => (part.type === 'tool-invocation' ? n + 1 : n), 0);
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

  // Map each tool-invocation to its position within a run of consecutive tool
  // parts, so consecutive cards compose into one bordered container.
  const toolGroupPositions = new Map<string, ToolGroupPosition>();
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type !== 'tool-invocation') continue;
    const prevIsTool = i > 0 && parts[i - 1].type === 'tool-invocation';
    const nextIsTool = i + 1 < parts.length && parts[i + 1].type === 'tool-invocation';
    const position: ToolGroupPosition = prevIsTool ? (nextIsTool ? 'middle' : 'last') : nextIsTool ? 'first' : 'single';
    toolGroupPositions.set(part.toolInvocation.toolCallId, position);
  }

  const origin = channelOrigin(entry);
  const roles: MessageRoleRenderers = {
    User: ({ children }) => (
      <div className="flex w-full flex-col items-end">
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
    Assistant: ({ children }) => (
      <div className="max-w-full">
        {toolCount > 1 && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setAllExpanded(v => (v === true ? false : true))}
              aria-pressed={allExpanded === true}
            >
              {allExpanded ? 'Collapse all' : `Expand all (${toolCount})`}
            </Button>
          </div>
        )}
        <div>{children}</div>
      </div>
    ),
    System: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
    Signal: ({ children }) => <div className="text-ui-sm text-icon3">{children}</div>,
  };

  const renderers = {
    Text: (part: TextPart) => {
      const renderedPart: unknown = part;
      const partIndex = parts.findIndex(candidate => candidate === renderedPart);
      const followsTool = partIndex > 0 && parts[partIndex - 1]?.type === 'tool-invocation';

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
        <div className={cn('prose', followsToolEntry ? 'mt-4' : followsTool ? 'mt-3' : undefined)}>
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
      const groupPosition = toolGroupPositions.get(tool.toolCallId);
      return (
        <ToolFactory
          toolName={tool.toolName}
          toolCallId={tool.toolCallId}
          input={suspension?.suspendPayload ?? tool.args}
          output={tool.result}
          status={suspension ? 'running' : tool.status}
          isSubmitting={isSubmitting}
          onRespond={suspension ? response => onRespond(tool.toolCallId, response, suspension.id) : undefined}
          fallback={() => <ToolCard tool={tool} forceExpanded={allExpanded} groupPosition={groupPosition} />}
        />
      );
    },
    File: (part: FilePart) => <FileAttachment part={part} />,
  };

  const notifications = notificationMetadata(entry);
  if (notifications.length > 0) {
    return (
      <div className="flex flex-col gap-2">
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

  const text = (entry.message.content.parts ?? [])
    .map(part => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
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
  return <Notice variant={status.level === 'error' ? 'destructive' : 'info'}>{status.text}</Notice>;
}

function NoticeCard({ entry }: { entry: NoticeEntry }) {
  return (
    <Notice variant={entry.level === 'error' ? 'destructive' : 'info'}>
      <div className="prose">
        <Markdown>{entry.text}</Markdown>
      </div>
    </Notice>
  );
}
