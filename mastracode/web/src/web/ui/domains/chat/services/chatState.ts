import type { AgentControllerTaskSnapshot } from '@mastra/client-js';

export interface OutgoingFile {
  data: string;
  mediaType: string;
  filename?: string;
}

export interface NoticeEntry {
  id: string;
  level: 'info' | 'error';
  text: string;
}

export interface ApprovalPrompt {
  kind: 'approval';
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
}

export interface SuspensionPrompt {
  kind: 'suspension';
  id: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  suspendPayload: unknown;
}

export type PromptEntry = ApprovalPrompt | SuspensionPrompt;

export interface NotificationEntry {
  id: string;
  notificationId?: string;
  message: string;
  source?: string;
  notifKind?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSummaryEntry {
  id: string;
  message: string;
  pending: number;
  bySource: Record<string, number>;
  byPriority: Record<string, number>;
  notificationIds: string[];
}

export interface SubagentEntry {
  id: string;
  toolCallId: string;
  agentType: string;
  task: string;
  modelId: string;
  done: boolean;
}

export interface ChatSurfaceState {
  prompts: PromptEntry[];
  notices: NoticeEntry[];
  notifications: NotificationEntry[];
  notificationSummaries: NotificationSummaryEntry[];
  subagents: SubagentEntry[];
  tasks: AgentControllerTaskSnapshot[];
  pending: boolean;
  workspaceReady?: boolean;
}

export const initialChatSurfaceState: ChatSurfaceState = {
  prompts: [],
  notices: [],
  notifications: [],
  notificationSummaries: [],
  subagents: [],
  tasks: [],
  pending: false,
};

const taskToolNames = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

export function extractLatestTaskSnapshot(messages: import('@mastra/core/agent-controller').MastraDBMessage[]) {
  let latest: AgentControllerTaskSnapshot[] = [];
  for (const message of messages) {
    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation') continue;
      const invocation = part.toolInvocation;
      if (!taskToolNames.has(invocation.toolName) || invocation.state !== 'result') continue;
      const snapshot = normalizeTaskSnapshot(invocation.result);
      if (snapshot) latest = snapshot;
    }
  }
  return latest;
}

function normalizeTaskSnapshot(value: unknown): AgentControllerTaskSnapshot[] | undefined {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  if (!isRecord(parsed)) return undefined;
  const nestedValue = isRecord(parsed.value) ? parsed.value : undefined;
  const tasks = parsed.tasks ?? nestedValue?.tasks;
  if (!Array.isArray(tasks)) return undefined;
  const normalized: AgentControllerTaskSnapshot[] = [];
  for (const task of tasks) {
    if (!isRecord(task)) return undefined;
    const { id, content, activeForm, status } = task;
    if (
      typeof id !== 'string' ||
      typeof content !== 'string' ||
      typeof activeForm !== 'string' ||
      (status !== 'pending' && status !== 'in_progress' && status !== 'completed')
    ) return undefined;
    normalized.push({ id, content, activeForm, status });
  }
  return normalized;
}

export function describeErrorEvent(event: { error: { message?: string } | string; errorType?: string }): string {
  const message = typeof event.error === 'string' ? event.error : event.error?.message;
  if (message) return message;
  if (event.errorType) return `Run failed (${event.errorType}). Check the server logs for details.`;
  return 'Run failed with an unknown error. Check the server logs for details.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
