import type { PlanResume } from '@mastra/client-js';
import { useState } from 'react';

import { Markdown } from './Markdown';

import type {
  ApprovalPrompt,
  AssistantEntry,
  GoalSnapshot,
  NoticeEntry,
  NotificationEntry,
  NotificationSummaryEntry,
  SubagentEntry,
  SuspensionPrompt,
  TimelineEntry,
  ToolCall,
  UserEntry,
  OMPhase,
  UsageSnapshot,
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

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? id;
}

// ---------------------------------------------------------------------------
// Tool card (collapsible)
// ---------------------------------------------------------------------------

function ToolCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const argsPreview = tool.args !== undefined ? JSON.stringify(tool.args) : tool.argsText;

  return (
    <div className="tool-card">
      <div className="tool-head" onClick={() => setExpanded(!expanded)}>
        <span className={`tool-status ${tool.status}`} />
        <span className="tool-name">{tool.toolName}</span>
        {argsPreview && !expanded && (
          <span className="tool-args-preview">{truncate(argsPreview, 80)}</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--fg-muted)', fontSize: 10 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && (
        <div className="tool-body">
          {argsPreview && <pre className="result-block">{argsPreview}</pre>}
          {tool.output && <pre className="shell-output">{tool.output}</pre>}
          {tool.status !== 'running' && tool.result !== undefined && (
            <pre className="result-block">{truncate(stringify(tool.result), 600)}</pre>
          )}
        </div>
      )}
      {!expanded && tool.output && (
        <div className="tool-body">
          <pre className="shell-output">{truncate(tool.output, 200)}</pre>
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
    <div className="prompt-card approval">
      <div className="prompt-title">
        Approve <code>{prompt.toolName}</code>?
      </div>
      <pre className="result-block">{truncate(stringify(prompt.args), 400)}</pre>
      <div className="prompt-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onApprove(prompt.toolCallId, true, prompt.id)}>
          Approve
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onApprove(prompt.toolCallId, false, prompt.id)}>
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

function SuspensionCard({
  prompt,
  onRespond,
}: {
  prompt: SuspensionPrompt;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  const payload = (prompt.suspendPayload ?? {}) as SuspendPayloadShape;

  if (prompt.toolName === 'submit_plan') {
    return (
      <div className="prompt-card suspension">
        <div className="prompt-title">Plan: {payload.plan?.title ?? payload.title ?? 'Proposed plan'}</div>
        {payload.plan?.summary && <div className="text">{payload.plan.summary}</div>}
        <div className="prompt-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onRespond(prompt.toolCallId, { action: 'approved' }, prompt.id)}>
            Approve &amp; build
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onRespond(prompt.toolCallId, { action: 'rejected' }, prompt.id)}>
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (prompt.toolName === 'request_access') {
    return (
      <div className="prompt-card suspension">
        <div className="prompt-title">Grant access to {payload.requestedPath ?? 'a path'}?</div>
        {payload.reason && <div style={{ color: 'var(--fg-dim)', fontSize: 12 }}>Reason: {payload.reason}</div>}
        <div className="prompt-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onRespond(prompt.toolCallId, 'Yes', prompt.id)}>
            Allow
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onRespond(prompt.toolCallId, 'No', prompt.id)}>
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
  return (
    <div className="prompt-card suspension">
      <div className="prompt-title">{payload.question ?? 'The agent has a question'}</div>
      {options.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {options.map(opt => (
            <button key={opt.label} className="prompt-option" onClick={() => onRespond(prompt.toolCallId, opt.label, prompt.id)}>
              <strong>{opt.label}</strong>
              {opt.description && <span style={{ color: 'var(--fg-dim)' }}> — {opt.description}</span>}
            </button>
          ))}
        </div>
      ) : (
        <form
          style={{ display: 'flex', gap: 8, marginTop: 6 }}
          onSubmit={e => {
            e.preventDefault();
            if (draft.trim()) onRespond(prompt.toolCallId, draft.trim(), prompt.id);
          }}
        >
          <input className="input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Your answer…" autoFocus />
          <button className="btn btn-primary btn-sm" type="submit">Reply</button>
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
      <div className="text" style={{ padding: '4px 0' }}>{entry.task}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification cards
// ---------------------------------------------------------------------------

function NotificationCard({ entry }: { entry: NotificationEntry }) {
  return (
    <div className="notif-card">
      <div className="tool-head">
        <span>🔔</span>
        <span className="tool-name">{entry.source ?? 'notification'}</span>
        {entry.priority && <span style={{ color: 'var(--fg-dim)', fontSize: 11 }}>[{entry.priority}]</span>}
      </div>
      <div className="text" style={{ padding: '4px 0' }}>{entry.message}</div>
    </div>
  );
}

function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <div className="notif-card">
      <div className="tool-head">
        <span>📬</span>
        <span className="tool-name">Notification summary</span>
        <span style={{ color: 'var(--fg-dim)', fontSize: 11 }}>{entry.pending} pending</span>
      </div>
      <div className="text" style={{ padding: '4px 0' }}>{entry.message}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export function Transcript({
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
          case 'user':
            return <UserBubble key={entry.id} entry={entry} />;
          case 'assistant':
            return <AssistantBubble key={entry.id} entry={entry} />;
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
}

function UserBubble({ entry }: { entry: UserEntry }) {
  return (
    <div className="bubble bubble-user">
      <div className={`role ${entry.steer ? 'role-steer' : ''}`}>{entry.steer ? 'steer' : 'you'}</div>
      <div className="text">{entry.text}</div>
    </div>
  );
}

function AssistantBubble({ entry }: { entry: AssistantEntry }) {
  if (!entry.text && entry.tools.length === 0) return null;
  return (
    <div className="bubble bubble-assistant">
      <div className="role">agent</div>
      {entry.text && (
        <div>
          <Markdown>{entry.text}</Markdown>
          {entry.streaming && <span className="streaming-cursor" />}
        </div>
      )}
      {entry.tools.map(t => (
        <ToolCard key={t.toolCallId} tool={t} />
      ))}
    </div>
  );
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
  modelId,
  running,
  followUpCount,
  omPhase,
  usage,
  workspaceReady,
}: {
  status: string;
  modeId?: string;
  modelId?: string;
  running: boolean;
  followUpCount?: number;
  omPhase?: OMPhase;
  usage?: UsageSnapshot;
  workspaceReady?: boolean;
}) {
  return (
    <div className="status-line">
      <span className="badge">{modeId ?? '—'}</span>
      <span>{modelId ? lastSegment(modelId) : 'no model'}</span>
      {workspaceReady !== undefined && (
        <span>{workspaceReady ? '📁' : '⚠️ no workspace'}</span>
      )}
      {omPhase && omPhase !== 'idle' && <span>🧠 {omPhase}</span>}
      {(followUpCount ?? 0) > 0 && <span>📋 {followUpCount} queued</span>}
      {usage?.totalTokens != null && <span>{(usage.totalTokens / 1000).toFixed(1)}k tokens</span>}
      <span style={{ flex: 1 }} />
      <span className={`connection-dot ${status}`} />
      <span>{running ? 'working…' : status === 'reconnecting' ? 'reconnecting…' : status}</span>
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
        <button className="btn btn-primary btn-sm" type="submit">Set Goal</button>
      </form>
    );
  }

  const statusIcon = goal.status === 'active' ? '🎯' : goal.status === 'paused' ? '⏸️' : '✅';
  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div className="goal-bar">
      <span>{statusIcon}</span>
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {goal.objective}
      </span>
      <span style={{ color: 'var(--fg-dim)' }}>{progress}</span>
      {goal.reason && (
        <span style={{ color: 'var(--fg-dim)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {goal.reason}
        </span>
      )}
      {goal.status === 'active' && (
        <button className="btn btn-danger btn-sm" onClick={onPauseGoal}>Pause</button>
      )}
      {goal.status === 'paused' && (
        <button className="btn btn-primary btn-sm" onClick={onResumeGoal}>Resume</button>
      )}
      <button className="btn btn-sm" onClick={onClearGoal}>Clear</button>
    </div>
  );
}
