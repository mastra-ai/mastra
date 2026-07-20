import type { AgentControllerEvent, AgentControllerOMProgress, KnownAgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { useReducer, useRef, useState } from 'react';

import {
  addOptimisticMessage,
  createCanonicalMessageState,
  resetCanonicalMessages,
  upsertCanonicalMessage,
} from '../services/canonicalMessages';
import {
  describeErrorEvent,
  extractLatestTaskSnapshot,
  initialChatSurfaceState,
} from '../services/chatState';
import type { ChatSurfaceState, OutgoingFile } from '../services/chatState';
import { initialChatRuntime, runtimeReducer } from '../services/runtime';
import type { UsageSnapshot } from '../services/runtime';

export interface SessionStateSnapshot {
  omProgress?: AgentControllerOMProgress;
  tokenUsage?: UsageSnapshot;
}

let localMessageSequence = 0;
let surfaceSequence = 0;

export function useAgentControllerTranscript({
  initialThreadId,
  initialMessages = [],
  initialState,
}: {
  initialThreadId?: string;
  initialMessages?: MastraDBMessage[];
  initialState?: SessionStateSnapshot;
} = {}) {
  const [messageState, setMessageState] = useState(() => createCanonicalMessageState(initialMessages, initialThreadId));
  const [surface, setSurface] = useState<ChatSurfaceState>(() => ({
    ...initialChatSurfaceState,
    tasks: extractLatestTaskSnapshot(initialMessages),
  }));
  const [runtime, dispatchRuntime] = useReducer(runtimeReducer, {
    ...initialChatRuntime,
    omProgress: initialState?.omProgress,
    usage: initialState?.tokenUsage,
  });
  const stateRef = useRef({ messageState, surface, runtime });
  stateRef.current = { messageState, surface, runtime };

  const reset = (threadId?: string, state?: SessionStateSnapshot, messages: MastraDBMessage[] = []) => {
    setMessageState(current => resetCanonicalMessages(current, threadId, messages));
    setSurface({ ...initialChatSurfaceState, tasks: extractLatestTaskSnapshot(messages) });
    dispatchRuntime({
      type: 'display_state_changed',
      displayState: { omProgress: state?.omProgress, tokenUsage: state?.tokenUsage },
    } as AgentControllerEvent);
  };

  const onEvent = (rawEvent: AgentControllerEvent) => {
    const event = rawEvent as KnownAgentControllerEvent;
    dispatchRuntime(rawEvent);
    switch (event.type) {
      case 'message_start':
      case 'message_update':
      case 'message_end':
        setMessageState(current => upsertCanonicalMessage(current, event.message));
        if (event.message.role === 'assistant') setSurface(current => ({ ...current, pending: false }));
        return;
      case 'agent_end':
        setSurface(current => ({ ...current, pending: false }));
        return;
      case 'tool_approval_required':
        setSurface(current => ({
          ...current,
          prompts: upsertByToolCallId(current.prompts, {
            kind: 'approval', id: `approval-${event.toolCallId}`, toolCallId: event.toolCallId,
            toolName: event.toolName, args: event.args,
          }),
        }));
        return;
      case 'tool_suspended':
        setSurface(current => ({
          ...current,
          prompts: upsertByToolCallId(current.prompts, {
            kind: 'suspension', id: `suspension-${event.toolCallId}`, toolCallId: event.toolCallId,
            toolName: event.toolName, args: event.args, suspendPayload: event.suspendPayload,
          }),
        }));
        return;
      case 'task_updated':
        setSurface(current => ({ ...current, tasks: event.tasks }));
        return;
      case 'notification':
        setSurface(current => ({
          ...current,
          notifications: [...current.notifications, {
            id: `notif-${event.notificationId ?? Date.now()}-${surfaceSequence++}`,
            notificationId: event.notificationId, message: event.message, source: event.source,
            notifKind: event.kind, priority: event.priority, metadata: event.metadata,
          }],
        }));
        return;
      case 'notification_summary':
        setSurface(current => ({
          ...current,
          notificationSummaries: [...current.notificationSummaries, {
            id: `notif-summary-${Date.now()}-${surfaceSequence++}`, message: event.message,
            pending: event.pending, bySource: event.bySource, byPriority: event.byPriority,
            notificationIds: event.notificationIds,
          }],
        }));
        return;
      case 'subagent_start':
        setSurface(current => ({
          ...current,
          subagents: upsertByToolCallId(current.subagents, {
            id: `subagent-${event.toolCallId}`, toolCallId: event.toolCallId, agentType: event.agentType,
            task: event.task, modelId: event.modelId, done: false,
          }),
        }));
        return;
      case 'subagent_end':
        setSurface(current => ({
          ...current,
          subagents: current.subagents.map(item => item.toolCallId === event.toolCallId ? { ...item, done: true } : item),
        }));
        return;
      case 'workspace_ready':
        setSurface(current => ({ ...current, workspaceReady: true }));
        return;
      case 'workspace_error':
        setSurface(current => ({ ...current, workspaceReady: false }));
        return;
      case 'info':
        pushNotice(event.message);
        return;
      case 'error':
        pushNotice(describeErrorEvent(event), 'error');
        return;
      default:
        return;
    }
  };

  const localUser = (text: string, _steer?: boolean, files?: OutgoingFile[]) => {
    const message: MastraDBMessage = {
      id: `local-${Date.now()}-${localMessageSequence++}`,
      role: 'user', createdAt: new Date(),
      content: { format: 2, parts: [
        { type: 'text', text },
        ...(files ?? []).map(file => ({
          type: 'file' as const, data: file.data, mimeType: file.mediaType,
          ...(file.filename && !file.mediaType.startsWith('image/') ? { filename: file.filename } : {}),
        })),
      ] },
    };
    setMessageState(current => addOptimisticMessage(current, message));
    setSurface(current => ({ ...current, pending: true }));
  };

  const resolvePrompt = (id: string) => setSurface(current => ({
    ...current, prompts: current.prompts.filter(prompt => prompt.id !== id),
  }));
  const clearPending = () => setSurface(current => ({ ...current, pending: false }));
  function pushNotice(text: string, level: 'info' | 'error' = 'info') {
    setSurface(current => ({
      ...current, notices: [...current.notices, { id: `notice-${Date.now()}-${surfaceSequence++}`, level, text }],
    }));
  }

  return { messageState, surface, runtime, stateRef, reset, onEvent, localUser, resolvePrompt, clearPending, pushNotice };
}

function upsertByToolCallId<T extends { toolCallId: string }>(items: T[], item: T): T[] {
  const index = items.findIndex(candidate => candidate.toolCallId === item.toolCallId);
  if (index < 0) return [...items, item];
  const next = [...items];
  next[index] = item;
  return next;
}
