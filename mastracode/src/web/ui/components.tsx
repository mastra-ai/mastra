import type { PlanResume, AgentControllerOMProgress } from '@mastra/client-js';
import { MessageFactory } from '@mastra/react';
import type { FilePart, MessageRoleRenderers, ReasoningPart, TextPart, ToolInvocationPart } from '@mastra/react';
import { memo, useEffect, useMemo, useState } from 'react';

import { highlightCode, languageForPath } from './highlight';
import { BellIcon, BrainIcon, ChevronIcon, CopyIcon, FolderIcon, LogoMark, TargetIcon, ToolIcon } from './icons';
import { Markdown } from './Markdown';
import { useToast } from './toast';

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
  if (percent >= 90) return 'sl-budget-high';
  if (percent >= 70) return 'sl-budget-mid';
  return '';
}

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? id;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <button
      type="button"
      className="copy-btn"
      title="Copy"
      aria-label="Copy"
      onClick={async e => {
        e.stopPropagation();
        try {
          if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast('Copied to clipboard', 'success');
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // Only report success when the write actually succeeded.
          toast('Could not copy to clipboard', 'error');
        }
      }}
    >
      {copied ? <span className="copy-ok">Copied</span> : <CopyIcon />}
    </button>
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

/** A unified-diff-style view of an edit's before/after text, syntax-highlighted. */
function DiffView({ oldText, newText, path }: { oldText: string; newText: string; path?: string }) {
  const lang = languageForPath(path);
  const removed = oldText.split('\n');
  const added = newText.split('\n');
  return (
    <div className="diff hljs" role="group" aria-label="File change">
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

/** A syntax-highlighted code block for full-file writes. */
function CodeBlock({ text, path }: { text: string; path?: string }) {
  const lang = languageForPath(path);
  return (
    <pre className="result-block hljs">
      <code dangerouslySetInnerHTML={{ __html: highlightCode(text, lang) }} />
    </pre>
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
    <div className={`tool-card ${tool.status}`}>
      <button type="button" className="tool-head" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className="tool-icon">
          <ToolIcon name={tool.toolName} />
        </span>
        <span className="tool-name">{tool.toolName}</span>
        {edit?.path && !expanded && <span className="tool-args-preview">{edit.path}</span>}
        {!edit && argsPreview && !expanded && <span className="tool-args-preview">{truncate(argsPreview, 72)}</span>}
        <span className={`tool-status-label ${tool.status}`}>{STATUS_LABEL[tool.status]}</span>
        <span className={`tool-status ${tool.status}`} title={STATUS_LABEL[tool.status]} />
        <ChevronIcon size={13} className={`tool-chevron ${expanded ? 'open' : ''}`} />
      </button>
      {expanded && (
        <div className="tool-body">
          {edit ? (
            <div className="tool-section">
              <div className="tool-section-head">
                <span>{edit.path ?? 'Change'}</span>
                <CopyButton text={edit.content ?? edit.new_string ?? ''} />
              </div>
              {edit.new_string !== undefined ? (
                <DiffView oldText={edit.old_string ?? ''} newText={edit.new_string} path={edit.path} />
              ) : (
                <CodeBlock text={truncate(edit.content ?? '', 2000)} path={edit.path} />
              )}
            </div>
          ) : argsPretty ? (
            <div className="tool-section">
              <div className="tool-section-head">
                <span>Arguments</span>
                <CopyButton text={argsPretty} />
              </div>
              <pre className="result-block">{argsPretty}</pre>
            </div>
          ) : null}
          {tool.output && (
            <div className="tool-section">
              <div className="tool-section-head">
                <span>Output</span>
                <CopyButton text={tool.output} />
              </div>
              <pre className="shell-output">{tool.output}</pre>
            </div>
          )}
          {resultText !== undefined && (
            <div className="tool-section">
              <div className="tool-section-head">
                <span>Result</span>
                <CopyButton text={resultText} />
              </div>
              <pre className="result-block">{truncate(resultText, 800)}</pre>
            </div>
          )}
        </div>
      )}
      {!expanded && tool.output && (
        <div className="tool-body">
          <pre className="shell-output collapsed-output">{truncate(tool.output, 180)}</pre>
        </div>
      )}
    </div>
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
    <div className="prompt-card approval" role="group" aria-label={`Tool approval for ${prompt.toolName}`}>
      <div className="prompt-title">
        Approve <code>{prompt.toolName}</code>?
      </div>
      <pre className="result-block">{truncate(stringify(prompt.args), 400)}</pre>
      <div className="prompt-actions">
        <button
          className="btn btn-primary btn-sm"
          aria-label={`Approve ${prompt.toolName}`}
          autoFocus
          onClick={() => onApprove(prompt.toolCallId, true, prompt.id)}
        >
          Approve
        </button>
        <button
          className="btn btn-danger btn-sm"
          aria-label={`Decline ${prompt.toolName}`}
          onClick={() => onApprove(prompt.toolCallId, false, prompt.id)}
        >
          Decline
        </button>
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
      <div className="prompt-card suspension" role="group" aria-label="Plan approval">
        <div className="prompt-title">Plan: {payload.plan?.title ?? payload.title ?? 'Proposed plan'}</div>
        {payload.plan?.summary && <div className="text">{payload.plan.summary}</div>}
        <div className="prompt-actions">
          <button
            className="btn btn-primary btn-sm"
            aria-label="Approve the plan and switch to build"
            autoFocus
            onClick={() => onRespond(prompt.toolCallId, { action: 'approved' }, prompt.id)}
          >
            Approve &amp; build
          </button>
          <button
            className="btn btn-danger btn-sm"
            aria-label="Reject the plan"
            onClick={() => onRespond(prompt.toolCallId, { action: 'rejected' }, prompt.id)}
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (prompt.toolName === 'request_access') {
    return (
      <div className="prompt-card suspension" role="group" aria-label="Access request">
        <div className="prompt-title">Grant access to {payload.requestedPath ?? 'a path'}?</div>
        {payload.reason && <div className="prompt-reason">Reason: {payload.reason}</div>}
        <div className="prompt-actions">
          <button
            className="btn btn-primary btn-sm"
            aria-label={`Allow access to ${payload.requestedPath ?? 'the requested path'}`}
            autoFocus
            onClick={() => onRespond(prompt.toolCallId, 'Yes', prompt.id)}
          >
            Allow
          </button>
          <button
            className="btn btn-danger btn-sm"
            aria-label={`Deny access to ${payload.requestedPath ?? 'the requested path'}`}
            onClick={() => onRespond(prompt.toolCallId, 'No', prompt.id)}
          >
            Deny
          </button>
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
    <div className="prompt-card suspension" role="group" aria-label="Question from the agent">
      <div className="prompt-title">{question}</div>
      {options.length > 0 ? (
        <div className="prompt-options" role="group" aria-label="Answer options">
          {options.map(opt => (
            <button
              key={opt.label}
              className="prompt-option"
              aria-label={opt.description ? `${opt.label}: ${opt.description}` : opt.label}
              onClick={() => onRespond(prompt.toolCallId, opt.label, prompt.id)}
            >
              <strong>{opt.label}</strong>
              {opt.description && <span className="prompt-option-desc"> — {opt.description}</span>}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="prompt-answer-form"
          onSubmit={e => {
            e.preventDefault();
            if (draft.trim()) onRespond(prompt.toolCallId, draft.trim(), prompt.id);
          }}
        >
          <input
            className="input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Your answer…"
            aria-label={question}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" type="submit">
            Reply
          </button>
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
    <div className="subagent-card">
      <div className="tool-head">
        <span className={`tool-status ${entry.done ? 'done' : 'running'}`} />
        <span className="tool-name">subagent: {entry.agentType}</span>
        <span style={{ color: 'var(--fg-dim)', fontSize: 11 }}>{lastSegment(entry.modelId)}</span>
      </div>
      <div className="text" style={{ padding: '4px 0' }}>
        {entry.task}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification cards
// ---------------------------------------------------------------------------

function NotificationCard({ entry }: { entry: NotificationEntry }) {
  return (
    <div className="notif-card">
      <div className="notif-head">
        <span className="notif-icon">
          <BellIcon size={13} />
        </span>
        <span className="tool-name">{entry.source ?? 'notification'}</span>
        {entry.priority && <span className={`notif-priority prio-${entry.priority}`}>{entry.priority}</span>}
      </div>
      <div className="notif-message">{entry.message}</div>
    </div>
  );
}

function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <div className="notif-card">
      <div className="notif-head">
        <span className="notif-icon">
          <BellIcon size={13} />
        </span>
        <span className="tool-name">Notification summary</span>
        <span className="notif-count">{entry.pending} pending</span>
      </div>
      <div className="notif-message">{entry.message}</div>
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
            return <Notice key={entry.id} entry={entry} />;
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
        <div className="msg msg-user">
          <div className="msg-head">
            <span className={`msg-role ${entry.steer ? 'role-steer' : ''}`}>{entry.steer ? 'Steer' : 'You'}</span>
          </div>
          <div className="bubble bubble-user">{children}</div>
        </div>
      ),
      Assistant: ({ children }) => (
        <div className="msg msg-assistant">
          <div className="msg-head">
            <span className="msg-avatar">
              <LogoMark size={14} />
            </span>
            <span className="msg-role">Agent</span>
            {toolCount > 1 && (
              <button
                type="button"
                className="tool-group-toggle"
                onClick={() => setAllExpanded(v => (v === true ? false : true))}
                aria-pressed={allExpanded === true}
              >
                {allExpanded ? 'Collapse all' : `Expand all (${toolCount})`}
              </button>
            )}
          </div>
          <div className="bubble bubble-assistant">{children}</div>
        </div>
      ),
      System: ({ children }) => (
        <div className="msg msg-assistant">
          <div className="msg-head">
            <span className="msg-role">System</span>
          </div>
          <div className="bubble bubble-assistant">{children}</div>
        </div>
      ),
      Signal: ({ children }) => (
        <div className="msg msg-assistant">
          <div className="msg-head">
            <span className="msg-role">Signal</span>
          </div>
          <div className="bubble bubble-assistant">{children}</div>
        </div>
      ),
    }),
    [allExpanded, entry.steer, toolCount],
  );

  const renderers = useMemo(
    () => ({
      Text: (part: TextPart) =>
        entry.message.role === 'user' ? (
          <div className="text">{part.text}</div>
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
      File: (part: FilePart) => <pre className="result-block">{stringify(part)}</pre>,
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
  return <div className={`notice ${status.level === 'error' ? 'error' : ''}`}>{status.text}</div>;
}

function Notice({ entry }: { entry: NoticeEntry }) {
  return <div className={`notice ${entry.level === 'error' ? 'error' : ''}`}>{entry.text}</div>;
}

// ---------------------------------------------------------------------------
// Status line
// ---------------------------------------------------------------------------

export function StatusLine({
  status,
  modeId,
  modeName,
  modelId,
  running,
  followUpCount,
  omPhase,
  omProgress,
  goal,
  workspaceReady,
  projectName,
  tokensPerSec,
}: {
  status: string;
  modeId?: string;
  modeName?: string;
  modelId?: string;
  running: boolean;
  followUpCount?: number;
  omPhase?: OMPhase;
  omProgress?: AgentControllerOMProgress;
  goal?: GoalSnapshot;
  workspaceReady?: boolean;
  projectName?: string;
  tokensPerSec?: number;
}) {
  // OM budgets, mirroring the TUI: msg = active message window before an
  // observation fires; mem = accumulated observations before a reflection fires.
  const om = omProgress;
  const showMsg = om && om.threshold > 0;
  const showMem = om && om.reflectionThreshold > 0 && om.observationTokens > 0;

  return (
    <div className="status-line">
      <span className="badge badge-mode" data-mode={modeId}>
        {modeName ?? modeId ?? '—'}
      </span>
      <span className="status-model">{modelId ? lastSegment(modelId) : 'no model'}</span>

      {showMsg && (
        <span
          className={`status-budget ${pctClass(om!.thresholdPercent)}`}
          title="Message window until next observation"
        >
          <span className="sl-label">msg</span> {fmtTokensValue(om!.pendingTokens)}/{fmtTokensThreshold(om!.threshold)}
          {om!.projectedMessageRemoval > 0 && (
            <span className="sl-buffer"> ↓{fmtTokensThreshold(om!.projectedMessageRemoval)}</span>
          )}
        </span>
      )}
      {showMem && (
        <span
          className={`status-budget ${pctClass(om!.reflectionThresholdPercent)}`}
          title="Observations accumulated until next reflection"
        >
          <span className="sl-label">mem</span> {fmtTokensValue(om!.observationTokens)}/
          {fmtTokensThreshold(om!.reflectionThreshold)}
          {om!.projectedReflectionSavings > 0 && (
            <span className="sl-buffer"> ↓{fmtTokensThreshold(om!.projectedReflectionSavings)}</span>
          )}
        </span>
      )}

      {projectName && (
        <span className="status-item">
          <FolderIcon size={13} /> {projectName}
        </span>
      )}
      {!projectName && workspaceReady !== undefined && (
        <span className="status-item">
          <FolderIcon size={13} /> {workspaceReady ? 'workspace' : 'no workspace'}
        </span>
      )}
      {omPhase && omPhase !== 'idle' && (
        <span className="status-item">
          <BrainIcon size={13} /> {omPhase}
        </span>
      )}
      {(tokensPerSec ?? 0) > 0 && <span className="status-item">{tokensPerSec} tok/s</span>}
      {(followUpCount ?? 0) > 0 && <span className="status-item">{followUpCount} queued</span>}
      {goal && goal.status !== 'done' && (
        <span className="status-goal">
          <TargetIcon size={13} /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
        </span>
      )}

      <span style={{ flex: 1 }} />
      <span className={`connection-dot ${status}`} />
      <span className="status-state">
        {running ? 'working…' : status === 'reconnecting' ? 'reconnecting…' : status}
      </span>
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
        className="goal-bar"
        onSubmit={e => {
          e.preventDefault();
          if (draft.trim()) {
            onSetGoal(draft.trim());
            setDraft('');
          }
        }}
      >
        <input
          className="input"
          style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Set a goal objective…"
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Set Goal
        </button>
      </form>
    );
  }

  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div className={`goal-bar goal-${goal.status}`}>
      <span className="goal-icon">
        <TargetIcon size={15} />
      </span>
      <span className="goal-objective">{goal.objective}</span>
      <span className="goal-progress">{progress}</span>
      {goal.reason && (
        <span style={{ color: 'var(--fg-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {goal.reason}
        </span>
      )}
      {goal.status === 'active' && (
        <button className="btn btn-danger btn-sm" onClick={onPauseGoal}>
          Pause
        </button>
      )}
      {goal.status === 'paused' && (
        <button className="btn btn-primary btn-sm" onClick={onResumeGoal}>
          Resume
        </button>
      )}
      <button className="btn btn-sm" onClick={onClearGoal}>
        Clear
      </button>
    </div>
  );
}
