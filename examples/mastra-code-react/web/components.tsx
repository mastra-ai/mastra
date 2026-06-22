import type { PlanResume } from '@mastra/client-js';
import { useState } from 'react';

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
// Tool card
// ---------------------------------------------------------------------------

function ToolCard({ tool }: { tool: ToolCall }) {
  const icon = tool.status === 'running' ? '⟳' : tool.status === 'error' ? '✗' : '✓';
  const argsPreview = tool.args !== undefined ? JSON.stringify(tool.args) : tool.argsText;
  return (
    <div style={S.tool}>
      <div style={S.toolHead}>
        <span style={{ ...S.toolIcon, ...(tool.status === 'error' ? { color: '#dc2626' } : {}) }}>{icon}</span>
        <span style={S.toolName}>{tool.toolName}</span>
        {argsPreview && <span style={S.toolArgs}>{truncate(argsPreview, 80)}</span>}
      </div>
      {tool.output && <pre style={S.shell}>{tool.output}</pre>}
      {tool.status !== 'running' && tool.result !== undefined && (
        <pre style={S.result}>{truncate(stringify(tool.result), 600)}</pre>
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
    <div style={S.prompt}>
      <div style={S.promptTitle}>
        Approve <code>{prompt.toolName}</code>?
      </div>
      <pre style={S.result}>{truncate(stringify(prompt.args), 400)}</pre>
      <div style={S.row}>
        <button style={S.approve} onClick={() => onApprove(prompt.toolCallId, true, prompt.id)}>
          Approve
        </button>
        <button style={S.decline} onClick={() => onApprove(prompt.toolCallId, false, prompt.id)}>
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
      <div style={S.prompt}>
        <div style={S.promptTitle}>Plan: {payload.plan?.title ?? payload.title ?? 'Proposed plan'}</div>
        {payload.plan?.summary && <div style={S.text}>{payload.plan.summary}</div>}
        <div style={S.row}>
          <button style={S.approve} onClick={() => onRespond(prompt.toolCallId, { action: 'approved' }, prompt.id)}>
            Approve &amp; build
          </button>
          <button style={S.decline} onClick={() => onRespond(prompt.toolCallId, { action: 'rejected' }, prompt.id)}>
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (prompt.toolName === 'request_access') {
    return (
      <div style={S.prompt}>
        <div style={S.promptTitle}>Grant access to {payload.requestedPath ?? 'a path'}?</div>
        {payload.reason && <div style={S.dim}>Reason: {payload.reason}</div>}
        <div style={S.row}>
          <button style={S.approve} onClick={() => onRespond(prompt.toolCallId, 'Yes', prompt.id)}>
            Allow
          </button>
          <button style={S.decline} onClick={() => onRespond(prompt.toolCallId, 'No', prompt.id)}>
            Deny
          </button>
        </div>
      </div>
    );
  }

  // ask_user
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
    <div style={S.prompt}>
      <div style={S.promptTitle}>{payload.question ?? 'The agent has a question'}</div>
      {options.length > 0 ? (
        <div style={S.col}>
          {options.map(opt => (
            <button key={opt.label} style={S.option} onClick={() => onRespond(prompt.toolCallId, opt.label, prompt.id)}>
              <strong>{opt.label}</strong>
              {opt.description && <span style={S.dim}> — {opt.description}</span>}
            </button>
          ))}
        </div>
      ) : (
        <form
          style={S.row}
          onSubmit={e => {
            e.preventDefault();
            if (draft.trim()) onRespond(prompt.toolCallId, draft.trim(), prompt.id);
          }}
        >
          <input style={S.input} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Your answer…" autoFocus />
          <button style={S.approve} type="submit">
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
    <div style={{ ...S.tool, borderColor: '#8b5cf6' }}>
      <div style={S.toolHead}>
        <span style={S.toolIcon}>{entry.done ? '✓' : '⟳'}</span>
        <span style={S.toolName}>subagent: {entry.agentType}</span>
        <span style={S.dim}>{lastSegment(entry.modelId)}</span>
      </div>
      <div style={S.text}>{entry.task}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification cards
// ---------------------------------------------------------------------------

function NotificationCard({ entry }: { entry: NotificationEntry }) {
  return (
    <div style={{ ...S.tool, borderColor: '#6366f1' }}>
      <div style={S.toolHead}>
        <span style={S.toolIcon}>🔔</span>
        <span style={S.toolName}>{entry.source ?? 'notification'}</span>
        {entry.priority && <span style={S.dim}>[{entry.priority}]</span>}
      </div>
      <div style={S.text}>{entry.message}</div>
    </div>
  );
}

function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <div style={{ ...S.tool, borderColor: '#6366f1' }}>
      <div style={S.toolHead}>
        <span style={S.toolIcon}>📬</span>
        <span style={S.toolName}>Notification summary</span>
        <span style={S.dim}>{entry.pending} pending</span>
      </div>
      <div style={S.text}>{entry.message}</div>
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
    <div style={{ ...S.bubble, ...S.user }}>
      <div style={S.role}>{entry.steer ? 'steer' : 'you'}</div>
      <div style={S.text}>{entry.text}</div>
    </div>
  );
}

function AssistantBubble({ entry }: { entry: AssistantEntry }) {
  if (!entry.text && entry.tools.length === 0) return null;
  return (
    <div style={{ ...S.bubble, ...S.assistant }}>
      <div style={S.role}>agent</div>
      {entry.text && <div style={S.text}>{entry.text}</div>}
      {entry.tools.map(t => (
        <ToolCard key={t.toolCallId} tool={t} />
      ))}
    </div>
  );
}

function Notice({ entry }: { entry: NoticeEntry }) {
  return <div style={{ ...S.notice, ...(entry.level === 'error' ? S.noticeError : {}) }}>{entry.text}</div>;
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
    <div style={S.status}>
      <span style={S.badge}>{modeId ?? '—'}</span>
      <span style={S.dim}>{modelId ? lastSegment(modelId) : 'no model'}</span>
      {workspaceReady !== undefined && (
        <span style={S.dim}>{workspaceReady ? '📁' : '⚠️ no workspace'}</span>
      )}
      {omPhase && omPhase !== 'idle' && (
        <span style={S.dim}>🧠 {omPhase}</span>
      )}
      {(followUpCount ?? 0) > 0 && (
        <span style={S.dim}>📋 {followUpCount} queued</span>
      )}
      {usage?.totalTokens != null && (
        <span style={S.dim}>{(usage.totalTokens / 1000).toFixed(1)}k tokens</span>
      )}
      <span style={{ flex: 1 }} />
      <span style={S.dim}>{running ? 'working…' : status}</span>
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
        style={{ ...S.goalBar, gap: 8 }}
        onSubmit={e => {
          e.preventDefault();
          if (draft.trim()) {
            onSetGoal(draft.trim());
            setDraft('');
          }
        }}
      >
        <input
          style={{ ...S.input, flex: 1, fontSize: 12 }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Set a goal objective…"
        />
        <button style={{ ...S.approve, fontSize: 11, padding: '4px 10px' }} type="submit">
          Set Goal
        </button>
      </form>
    );
  }

  const statusIcon = goal.status === 'active' ? '🎯' : goal.status === 'paused' ? '⏸️' : '✅';
  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div style={S.goalBar}>
      <span>{statusIcon}</span>
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {goal.objective}
      </span>
      <span style={S.dim}>{progress}</span>
      {goal.reason && <span style={{ ...S.dim, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.reason}</span>}
      {goal.status === 'active' && (
        <button style={{ ...S.decline, fontSize: 11, padding: '2px 8px' }} onClick={onPauseGoal}>
          Pause
        </button>
      )}
      {goal.status === 'paused' && (
        <button style={{ ...S.approve, fontSize: 11, padding: '2px 8px' }} onClick={onResumeGoal}>
          Resume
        </button>
      )}
      <button style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }} onClick={onClearGoal}>
        Clear
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers + styles
// ---------------------------------------------------------------------------

function stringify(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] || id;
}

const S: Record<string, React.CSSProperties> = {
  bubble: { padding: '8px 12px', borderRadius: 10, maxWidth: '90%' },
  user: { alignSelf: 'flex-end', background: '#2563eb', color: 'white' },
  assistant: { alignSelf: 'flex-start', background: '#f3f4f6', color: '#111827' },
  role: { fontSize: 10, textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 },
  text: { whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  dim: { color: '#9ca3af', fontSize: 12 },
  tool: { marginTop: 6, padding: '6px 8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 },
  toolHead: { display: 'flex', gap: 6, alignItems: 'baseline', fontFamily: 'ui-monospace, monospace', fontSize: 12 },
  toolIcon: { color: '#2563eb' },
  toolName: { fontWeight: 600 },
  toolArgs: { color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' },
  shell: { margin: '6px 0 0', padding: 6, background: '#0b1021', color: '#d1d5db', borderRadius: 6, fontSize: 11, maxHeight: 160, overflow: 'auto' },
  result: { margin: '6px 0 0', padding: 6, background: '#f9fafb', borderRadius: 6, fontSize: 11, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' },
  prompt: { alignSelf: 'stretch', padding: 12, border: '1px solid #d1d5db', borderRadius: 10, background: '#fffbeb' },
  promptTitle: { fontWeight: 600, marginBottom: 8 },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 },
  col: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 },
  option: { textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' },
  approve: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer' },
  decline: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' },
  input: { flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' },
  notice: { alignSelf: 'center', color: '#6b7280', fontSize: 12, fontStyle: 'italic' },
  noticeError: { color: '#dc2626' },
  status: { display: 'flex', gap: 8, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid #e5e7eb', fontSize: 12 },
  badge: { padding: '2px 8px', borderRadius: 6, background: '#111827', color: 'white', fontWeight: 600 },
  goalBar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderBottom: '1px solid #e5e7eb', background: '#fffbeb', fontSize: 12 },
};
