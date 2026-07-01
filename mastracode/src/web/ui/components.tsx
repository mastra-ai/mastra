import type { PlanResume, AgentControllerModeInfo, AgentControllerOMProgress } from '@mastra/client-js';
import {
  Badge,
  Button,
  ButtonsGroup,
  CodeBlock as DsCodeBlock,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CopyButton,
  Input,
  Notice,
  Txt,
} from '@mastra/playground-ui';
import { MessageFactory } from '@mastra/react';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react';
import {
  Bell,
  Brain,
  ChevronRight,
  Eye,
  Folder,
  Globe,
  ListChecks,
  Pencil,
  Search,
  Target,
  Terminal,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import { highlightCode, languageForPath } from './highlight';

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
import { Markdown } from './Markdown';

import type {
  ApprovalPrompt,
  GoalSnapshot,
  MessageEntry,
  NoticeEntry,
  NotificationEntry,
  NotificationSummaryEntry,
  SubagentEntry,
  SuspensionPrompt,
  TimelineEntry,
  ToolCall,
  OMPhase,
} from './transcript';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Monospace, scrollable container for serialized args/results/file dumps.
const resultBlock =
  'm-0 mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap break-all rounded-sm bg-surface1 p-2 font-mono text-xs leading-normal text-icon5';

// Prompt cards (approval / suspension) — an elevated card with a colored left rail.
const promptCardBase = 'rounded-lg border border-border1 bg-surface3 px-4 py-3 shadow-md';
const promptCardApproval = `${promptCardBase} border-l-4 border-l-warning1`;
const promptCardSuspension = `${promptCardBase} border-l-4 border-l-accent2`;
const promptTitle = 'mb-1.5 text-sm font-semibold text-icon6';
const promptActions = 'mt-2 flex gap-2';

// Status line items.
const statusItem = 'inline-flex items-center gap-1 text-icon3 [&_svg]:text-icon2';
const statusBudget = 'inline-flex items-baseline whitespace-nowrap text-icon3 tabular-nums';
const slLabel = 'mr-1 text-icon2';
const slBuffer = 'italic text-icon2';

// Goal bar — horizontal control strip below the header.
const goalBar = 'flex shrink-0 items-center gap-2.5 border-b border-border1 bg-accent2/5 px-4 py-2 text-xs';

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

/** "12500" → "12.5", "8000" → "8" (no unit; mirrors the TUI's compact value). */
function fmtTokensValue(n: number): string {
  if (n <= 0) return '0';
  const s = (n / 1000).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** "30000" → "30k", "40000" → "40k" (threshold with unit; mirrors the TUI). */
function fmtTokensThreshold(n: number): string {
  const s = (n / 1000).toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + 'k';
}

/** Pick a severity class as a usage fraction climbs toward its threshold. */
function pctClass(percent: number): string {
  if (percent >= 90) return 'text-error';
  if (percent >= 70) return 'text-warning1';
  return '';
}

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? id;
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
    <div className="flex flex-col gap-1">
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
    <div className="diff hljs rounded-xl" role="group" aria-label="File change">
      {removed.map((line, i) => (
        <div key={`r${i}`} className="diff-line removed">
          <span className="diff-gutter">-</span>
          <span className="diff-text" dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || '&nbsp;' }} />
        </div>
      ))}
      {added.map((line, i) => (
        <div key={`a${i}`} className="diff-line added">
          <span className="diff-gutter">+</span>
          <span className="diff-text" dangerouslySetInnerHTML={{ __html: highlightCode(line, lang) || '&nbsp;' }} />
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

function ToolCard({ tool, forceExpanded }: { tool: ToolCall; forceExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // When the parent toggles "expand/collapse all", follow that signal.
  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);
  const argsPreview = tool.args !== undefined ? JSON.stringify(tool.args) : tool.argsText;
  const argsPretty = tool.args !== undefined ? stringify(tool.args) : tool.argsText;
  const resultText = tool.status !== 'running' && tool.result !== undefined ? stringify(tool.result) : undefined;
  const edit = editArgs(tool.toolName, tool.args);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="rounded-xl border border-border1 bg-surface3"
      role="group"
      aria-label={`Tool: ${tool.toolName}`}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-1.5 text-left">
        <ToolIcon name={tool.toolName} />
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
        <ChevronRight
          size={13}
          className={`shrink-0 text-icon3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 px-2 pb-2">
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
            <pre className="m-0 max-h-72 overflow-y-auto whitespace-pre-wrap break-all rounded-xl bg-surface1 px-3 py-2 font-mono text-xs leading-normal text-icon3">
              {tool.output}
            </pre>
          </ToolSection>
        )}
        {resultText !== undefined && <DsCodeBlock code={truncate(resultText, 800)} lang="json" fileName="Result" />}
      </CollapsibleContent>
      {!expanded && tool.output && (
        <pre className="mx-2 mb-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-all rounded-xl bg-surface1 px-3 py-2 font-mono text-xs leading-normal text-icon3 opacity-75">
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
  onApprove,
}: {
  prompt: ApprovalPrompt;
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
          onClick={() => onApprove(prompt.toolCallId, true, prompt.id)}
        >
          Approve
        </Button>
        <Button
          size="sm"
          aria-label={`Decline ${prompt.toolName}`}
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
  onRespond,
}: {
  prompt: SuspensionPrompt;
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
            onClick={() => onRespond(prompt.toolCallId, { action: 'approved' }, prompt.id)}
          >
            Approve &amp; build
          </Button>
          <Button
            size="sm"
            aria-label="Reject the plan"
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
            onClick={() => onRespond(prompt.toolCallId, 'Yes', prompt.id)}
          >
            Allow
          </Button>
          <Button
            size="sm"
            aria-label={`Deny access to ${payload.requestedPath ?? 'the requested path'}`}
            onClick={() => onRespond(prompt.toolCallId, 'No', prompt.id)}
          >
            Deny
          </Button>
        </div>
      </div>
    );
  }

  return <AskUserCard prompt={prompt} payload={payload} onRespond={onRespond} />;
}

function AskUserCard({
  prompt,
  payload,
  onRespond,
}: {
  prompt: SuspensionPrompt;
  payload: SuspendPayloadShape;
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
            autoFocus
          />
          <Button variant="primary" size="sm" type="submit">
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

function NotificationCard({ entry }: { entry: NotificationEntry }) {
  return (
    <div className="rounded-lg border border-l-4 border-border1 border-l-accent3 bg-surface2 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Bell size={13} />
        <Txt variant="ui-sm" font="mono">
          {entry.source ?? 'notification'}
        </Txt>
        {entry.priority && (
          <Badge variant={entry.priority === 'high' || entry.priority === 'urgent' ? 'error' : 'default'}>
            {entry.priority}
          </Badge>
        )}
      </div>
      <Txt variant="ui-sm" className="py-1">
        {entry.message}
      </Txt>
    </div>
  );
}

function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <div className="rounded-lg border border-l-4 border-border1 border-l-accent3 bg-surface2 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Bell size={13} />
        <Txt variant="ui-sm" font="mono">
          Notification summary
        </Txt>
        <Badge variant="info">{entry.pending} pending</Badge>
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

export const Transcript = memo(function Transcript({
  entries,
  onApprove,
  onRespond,
}: {
  entries: TimelineEntry[];
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  return (
    <>
      {entries.map(entry => {
        switch (entry.kind) {
          case 'message':
            return <MessageBubble key={entry.id} entry={entry} />;
          case 'notice':
            return <NoticeCard key={entry.id} entry={entry} />;
          case 'approval':
            return <ApprovalCard key={entry.id} prompt={entry} onApprove={onApprove} />;
          case 'notification':
            return <NotificationCard key={entry.id} entry={entry} />;
          case 'notification_summary':
            return <NotificationSummaryCard key={entry.id} entry={entry} />;
          case 'suspension':
            return <SuspensionCard key={entry.id} prompt={entry} onRespond={onRespond} />;
          case 'subagent':
            return <SubagentCard key={entry.id} entry={entry} />;
          default:
            return null;
        }
      })}
    </>
  );
});

function MessageBubble({ entry }: { entry: MessageEntry }) {
  // null = no group override; true/false = expand/collapse all in this bubble.
  const [allExpanded, setAllExpanded] = useState<boolean | undefined>(undefined);
  const parts = entry.message.content.parts ?? [];
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

  const roles = useMemo<MessageRoleRenderers>(
    () => ({
      User: ({ children }) => (
        <div className="flex w-full flex-col items-end">
          <div
            className={`max-w-[70%] break-words rounded-xl px-4 py-2 text-text1 ${
              entry.steer ? 'bg-warning1/10' : 'bg-surface3'
            }`}
          >
            {children}
          </div>
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
    }),
    [allExpanded, entry.steer, toolCount],
  );

  const renderers = useMemo(
    () => ({
      Text: (part: TextPart) =>
        entry.message.role === 'user' ? (
          <div className="prose">
            <Markdown>{part.text}</Markdown>
          </div>
        ) : (
          <div className="prose">
            <Markdown>{part.text}</Markdown>
            {entry.streaming && part === lastTextPart && <span className="streaming-cursor" />}
          </div>
        ),
      Reasoning: (part: ReasoningPart) => (
        <div className="thinking-block">
          <Markdown>{part.reasoning}</Markdown>
        </div>
      ),
      ToolInvocation: (part: ToolInvocationPart) => {
        const runtime = entry.runtimeTools?.[part.toolInvocation.toolCallId];
        const tool = toolFromInvocationPart(part, runtime);
        return <ToolCard tool={tool} forceExpanded={allExpanded} />;
      },
      File: (part: FilePart) => <pre className={resultBlock}>{stringify(part)}</pre>,
    }),
    [allExpanded, entry.message.role, entry.runtimeTools, entry.streaming, lastTextPart],
  );

  const status = statusMetadata(entry);
  if (status) return <StatusMetadataCard status={status} />;
  if (entry.message.role === 'assistant' && !hasRenderablePart) return null;

  return <MessageFactory message={entry.message} roles={roles} {...renderers} fallback={() => null} />;
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

  const text = 'text' in statusPart && typeof statusPart.text === 'string' ? statusPart.text : messageText(entry);
  return {
    id: `${entry.id}-${String(statusPart.type)}`,
    text,
    level: statusPart.type === 'harness-error' ? 'error' : 'info',
  };
}

function messageText(entry: MessageEntry): string {
  return entry.message.content.parts.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('');
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

// ---------------------------------------------------------------------------
// Status line
// ---------------------------------------------------------------------------

export function StatusLine({
  status,
  modelId,
  running,
  followUpCount,
  omPhase,
  omProgress,
  goal,
  workspaceReady,
  projectName,
  tokensPerSec,
  modes,
  activeModeId,
  onModeChange,
}: {
  status: string;
  modelId?: string;
  running: boolean;
  followUpCount?: number;
  omPhase?: OMPhase;
  omProgress?: AgentControllerOMProgress;
  goal?: GoalSnapshot;
  workspaceReady?: boolean;
  projectName?: string;
  tokensPerSec?: number;
  modes?: AgentControllerModeInfo[];
  activeModeId?: string;
  onModeChange?: (modeId: string) => void;
}) {
  // OM budgets, mirroring the TUI: msg = active message window before an
  // observation fires; mem = accumulated observations before a reflection fires.
  const om = omProgress;
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;

  return (
    <div className="flex shrink-0 items-center gap-3 py-2 text-ui-sm text-icon3">
      {modes && modes.length > 0 && onModeChange && (
        <div role="group" aria-label="Session mode" className="shrink-0">
          <ButtonsGroup spacing="close">
            {modes.map(m => (
              <Button
                key={m.id}
                variant={activeModeId === m.id ? 'primary' : 'ghost'}
                size="sm"
                aria-pressed={activeModeId === m.id}
                onClick={() => onModeChange(m.id)}
              >
                {m.name ?? m.id}
              </Button>
            ))}
          </ButtonsGroup>
        </div>
      )}

      <span className="text-icon3 tabular-nums">{modelId ? lastSegment(modelId) : 'no model'}</span>

      {showMsg && (
        <span
          className={`${statusBudget} ${pctClass(om!.thresholdPercent)}`}
          title="Message window until next observation"
        >
          <span className={slLabel}>msg</span> {fmtTokensValue(om!.pendingTokens)}/{fmtTokensThreshold(om!.threshold)}
          {om!.projectedMessageRemoval > 0 && (
            <span className={slBuffer}> ↓{fmtTokensThreshold(om!.projectedMessageRemoval)}</span>
          )}
        </span>
      )}
      {showMem && (
        <span
          className={`${statusBudget} ${pctClass(om!.reflectionThresholdPercent)}`}
          title="Observations accumulated until next reflection"
        >
          <span className={slLabel}>mem</span> {fmtTokensValue(om!.observationTokens)}/
          {fmtTokensThreshold(om!.reflectionThreshold)}
          {om!.projectedReflectionSavings > 0 && (
            <span className={slBuffer}> ↓{fmtTokensThreshold(om!.projectedReflectionSavings)}</span>
          )}
        </span>
      )}

      {projectName && (
        <span className={statusItem}>
          <Folder size={13} /> {projectName}
        </span>
      )}
      {!projectName && workspaceReady !== undefined && (
        <span className={statusItem}>
          <Folder size={13} /> {workspaceReady ? 'workspace' : 'no workspace'}
        </span>
      )}
      {omPhase && omPhase !== 'idle' && (
        <span className={statusItem}>
          <Brain size={13} /> {omPhase}
        </span>
      )}
      {(tokensPerSec ?? 0) > 0 && <span className={statusItem}>{tokensPerSec} tok/s</span>}
      {(followUpCount ?? 0) > 0 && <span className={statusItem}>{followUpCount} queued</span>}
      {goal && goal.status !== 'done' && (
        <span className="inline-flex items-center gap-1 text-accent2 [&_svg]:text-accent2">
          <Target size={13} /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
        </span>
      )}

      <span className="flex-1" />
      <span className={`connection-dot ${status}`} />
      <span className="capitalize">{running ? 'working…' : status === 'reconnecting' ? 'reconnecting…' : status}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal panel
// ---------------------------------------------------------------------------

export function GoalPanel({
  goal,
  onSetGoal,
  onPauseGoal,
  onResumeGoal,
  onClearGoal,
}: {
  goal?: GoalSnapshot;
  onSetGoal: (objective: string) => void;
  onPauseGoal: () => void;
  onResumeGoal: () => void;
  onClearGoal: () => void;
}) {
  const [draft, setDraft] = useState('');

  if (!goal) {
    return (
      <form
        className={goalBar}
        onSubmit={e => {
          e.preventDefault();
          if (draft.trim()) {
            onSetGoal(draft.trim());
            setDraft('');
          }
        }}
      >
        <Input
          className="flex-1"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Set a goal objective…"
        />
        <Button variant="primary" size="sm" type="submit">
          Set Goal
        </Button>
      </form>
    );
  }

  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div className={goalBar}>
      <span className="inline-flex text-accent2">
        <Target size={15} />
      </span>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ui-sm font-medium">
        {goal.objective}
      </span>
      <span className="rounded-full border border-border1 bg-surface2 px-2 py-px text-ui-sm tabular-nums text-icon3">
        {progress}
      </span>
      {goal.reason && (
        <span className="max-w-52 overflow-hidden text-ellipsis whitespace-nowrap text-icon3">{goal.reason}</span>
      )}
      {goal.status === 'active' && (
        <Button size="sm" onClick={onPauseGoal}>
          Pause
        </Button>
      )}
      {goal.status === 'paused' && (
        <Button variant="primary" size="sm" onClick={onResumeGoal}>
          Resume
        </Button>
      )}
      <Button size="sm" onClick={onClearGoal}>
        Clear
      </Button>
    </div>
  );
}
