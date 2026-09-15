import type { SessionNotification, RequestPermissionRequest, AgentSideConnection } from '@agentclientprotocol/sdk';
import type { AgentControllerEvent, MastraDBMessage, Session, TokenUsage } from '@mastra/core/agent-controller';
import { mastraDBMessageToSignal } from '@mastra/core/signals';

/** Concatenate the text of all `text` parts on a DB-native assistant message. */
function getMessageText(message: MastraDBMessage): string {
  const content = message.content;
  if (typeof content === 'string' || !content?.parts) return '';
  return content.parts
    .filter((part): part is Extract<(typeof content.parts)[number], { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('');
}

function getSignalText(message: MastraDBMessage): string {
  const contents = mastraDBMessageToSignal(message).contents;
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';
  return contents
    .filter((part): part is Extract<(typeof contents)[number], { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

let autoApprove = false;

/**
 * Enable or disable automatic tool approval (set via --dangerous-auto-approve CLI flag).
 */
export function setAutoApprove(value: boolean): void {
  autoApprove = value;
}

/**
 * Map a mastracode tool name to an ACP ToolKind.
 */
function mapToolKind(
  toolName: string,
): 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other' {
  const name = toolName.toLowerCase();
  if (name.includes('edit') || name.includes('write') || name.includes('replace') || name.includes('patch'))
    return 'edit';
  if (name.includes('read') || name.includes('view') || name.includes('list') || name.includes('find')) return 'read';
  if (name.includes('delete') || name.includes('remove')) return 'delete';
  if (name.includes('search') || name.includes('grep') || name.includes('query')) return 'search';
  if (name.includes('execute') || name.includes('run') || name.includes('command') || name.includes('shell'))
    return 'execute';
  if (
    name.includes('fetch') ||
    name.includes('curl') ||
    name.includes('http') ||
    name.includes('browse') ||
    name.includes('navigate')
  )
    return 'fetch';
  if (name.includes('think') || name.includes('reason')) return 'think';
  return 'other';
}

/**
 * Accumulated state for an active prompt turn.
 */
export interface PromptState {
  sessionId: string;
  lastTextLength: number;
  usage: TokenUsage;
  resolve: (reason: 'complete' | 'aborted' | 'error' | 'suspended') => void;
}

/**
 * Translate an AgentControllerEvent into an ACP SessionNotification and send it
 * via the provided connection. Returns null for events that don't produce
 * a session update.
 */
export function handleAgentControllerEvent(
  event: AgentControllerEvent,
  state: PromptState | null,
  connection: AgentSideConnection,
  session: Session,
): void {
  if (!state) return;

  switch (event.type) {
    case 'agent_start':
      state.lastTextLength = 0;
      break;

    case 'message_start': {
      if (event.message.role !== 'signal') break;
      const text = getSignalText(event.message);
      if (text) {
        sendUpdate(connection, state.sessionId, {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text },
        });
      }
      break;
    }

    case 'message_update': {
      if (event.message.role !== 'assistant') break;
      const fullText = getMessageText(event.message);
      if (fullText.length > state.lastTextLength) {
        const delta = fullText.slice(state.lastTextLength);
        state.lastTextLength = fullText.length;
        sendUpdate(connection, state.sessionId, {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: delta },
        });
      }
      break;
    }

    case 'message_end':
      if (event.message.role === 'assistant') state.lastTextLength = 0;
      break;

    case 'tool_start':
      sendUpdate(connection, state.sessionId, {
        sessionUpdate: 'tool_call',
        toolCallId: event.toolCallId,
        title: event.toolName,
        kind: mapToolKind(event.toolName),
        status: 'in_progress',
        rawInput: JSON.stringify(event.args),
      });
      break;

    case 'tool_end':
      sendUpdate(connection, state.sessionId, {
        sessionUpdate: 'tool_call_update',
        toolCallId: event.toolCallId,
        status: event.isError ? 'failed' : 'completed',
        rawOutput: typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
      });
      break;

    case 'tool_approval_required':
      void handleToolApproval(state, connection, session, event).catch(err => {
        process.stderr.write(`[acp] handleToolApproval error: ${err}\n`);
      });
      break;

    case 'tool_suspended':
      void handleToolSuspended(state, connection, session, event).catch(err => {
        process.stderr.write(`[acp] handleToolSuspended error: ${err}\n`);
      });
      break;

    case 'usage_update':
      accumulateUsage(state.usage, event.usage);
      break;

    case 'agent_end':
      state.resolve(event.reason ?? 'complete');
      break;

    // Ignored in v1: om_*, subagent_*, workspace_*, task_updated, etc.
    default:
      break;
  }
}

function sendUpdate(connection: AgentSideConnection, sessionId: string, update: SessionNotification['update']): void {
  connection.sessionUpdate({ sessionId, update }).catch(err => {
    process.stderr.write(`[acp] sessionUpdate error: ${err}\n`);
  });
}

async function handleToolApproval(
  state: PromptState,
  connection: AgentSideConnection,
  session: Session,
  event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }>,
): Promise<void> {
  // Auto-approve if --dangerous-auto-approve flag is set
  if (autoApprove) {
    session.respondToToolApproval({ decision: 'approve' });
    return;
  }

  const req: RequestPermissionRequest = {
    sessionId: state.sessionId,
    toolCall: {
      toolCallId: event.toolCallId,
      title: event.toolName,
      rawInput: JSON.stringify(event.args),
    },
    options: [
      { optionId: 'approve', name: 'Allow', kind: 'allow_once' },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
    ],
  };

  try {
    const resp = await connection.requestPermission(req);
    if (resp.outcome.outcome === 'selected') {
      const decision = resp.outcome.optionId === 'approve' ? 'approve' : 'decline';
      session.respondToToolApproval({ decision });
    } else {
      session.respondToToolApproval({ decision: 'decline' });
    }
  } catch (err) {
    process.stderr.write(`[acp] requestPermission error: ${err}\n`);
    session.respondToToolApproval({ decision: 'decline' });
  }
}

async function handleToolSuspended(
  state: PromptState,
  connection: AgentSideConnection,
  session: Session,
  event: Extract<AgentControllerEvent, { type: 'tool_suspended' }>,
): Promise<void> {
  const { toolCallId, toolName, args, suspendPayload } = event;

  // Auto-resolve certain suspensions (mirrors headless.ts autoResolve)
  if (toolName === 'request_access' || (suspendPayload as any)?.kind === 'sandbox_access_request') {
    void session.respondToToolSuspension({ toolCallId, resumeData: 'Yes' });
    return;
  }

  if (toolName === 'submit_plan') {
    // Request permission for plan approval
    const req: RequestPermissionRequest = {
      sessionId: state.sessionId,
      toolCall: {
        toolCallId,
        title: toolName,
        rawInput: JSON.stringify(args),
      },
      options: [
        { optionId: 'approve', name: 'Approve Plan', kind: 'allow_once' },
        { optionId: 'reject', name: 'Reject Plan', kind: 'reject_once' },
      ],
    };

    try {
      const resp = await connection.requestPermission(req);
      const action =
        resp.outcome.outcome === 'selected' && resp.outcome.optionId === 'approve' ? 'approved' : 'rejected';
      void session.respondToToolSuspension({ toolCallId, resumeData: { action } });
    } catch {
      void session.respondToToolSuspension({ toolCallId, resumeData: { action: 'rejected' } });
    }
    return;
  }

  // For ask_user and other suspensions, auto-resolve
  void session.respondToToolSuspension({
    toolCallId,
    resumeData: 'Proceed with your best judgment. Do not ask further questions.',
  });
}

function accumulateUsage(target: TokenUsage, usage: TokenUsage): void {
  target.promptTokens += usage.promptTokens;
  target.completionTokens += usage.completionTokens;
  target.totalTokens += usage.totalTokens;
  if (usage.reasoningTokens) target.reasoningTokens = (target.reasoningTokens ?? 0) + usage.reasoningTokens;
  if (usage.cachedInputTokens) target.cachedInputTokens = (target.cachedInputTokens ?? 0) + usage.cachedInputTokens;
  if (usage.cacheCreationInputTokens) {
    target.cacheCreationInputTokens = (target.cacheCreationInputTokens ?? 0) + usage.cacheCreationInputTokens;
  }
}
