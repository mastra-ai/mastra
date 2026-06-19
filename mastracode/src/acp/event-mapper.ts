import type {
  SessionNotification,
  RequestPermissionRequest,
  AgentSideConnection,
} from '@agentclientprotocol/sdk';
import type { Harness, HarnessEvent, TokenUsage } from '@mastra/core/harness';

/**
 * Map a mastracode tool name to an ACP ToolKind.
 */
function mapToolKind(toolName: string): 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other' {
  const name = toolName.toLowerCase();
  if (name.includes('edit') || name.includes('write') || name.includes('replace') || name.includes('patch')) return 'edit';
  if (name.includes('read') || name.includes('view') || name.includes('list') || name.includes('find')) return 'read';
  if (name.includes('delete') || name.includes('remove')) return 'delete';
  if (name.includes('search') || name.includes('grep') || name.includes('query')) return 'search';
  if (name.includes('execute') || name.includes('run') || name.includes('command') || name.includes('shell')) return 'execute';
  if (name.includes('fetch') || name.includes('curl') || name.includes('http') || name.includes('browse') || name.includes('navigate')) return 'fetch';
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
 * Translate a HarnessEvent into an ACP SessionNotification and send it
 * via the provided connection. Returns null for events that don't produce
 * a session update.
 */
export function handleHarnessEvent(
  event: HarnessEvent,
  state: PromptState | null,
  connection: AgentSideConnection,
  harness: Harness,
): void {
  if (!state) return;

  switch (event.type) {
    case 'agent_start':
      state.lastTextLength = 0;
      break;

    case 'message_update': {
      if (event.message.role !== 'assistant') break;
      const fullText = event.message.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(p => p.text)
        .join('');
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
      state.lastTextLength = 0;
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
      handleToolApproval(state, connection, harness, event);
      break;

    case 'tool_suspended':
      handleToolSuspended(state, connection, harness, event);
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

function sendUpdate(
  connection: AgentSideConnection,
  sessionId: string,
  update: SessionNotification['update'],
): void {
  connection.sessionUpdate({ sessionId, update }).catch(err => {
    process.stderr.write(`[acp] sessionUpdate error: ${err}\n`);
  });
}

async function handleToolApproval(
  state: PromptState,
  connection: AgentSideConnection,
  harness: Harness,
  event: Extract<HarnessEvent, { type: 'tool_approval_required' }>,
): Promise<void> {
  // Auto-approve if env var is set
  if (process.env.MASTRACODE_ACP_AUTO_APPROVE === '1') {
    harness.session.respondToToolApproval({ decision: 'approve' });
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
      harness.session.respondToToolApproval({ decision });
    } else {
      harness.session.respondToToolApproval({ decision: 'decline' });
    }
  } catch (err) {
    process.stderr.write(`[acp] requestPermission error: ${err}\n`);
    harness.session.respondToToolApproval({ decision: 'decline' });
  }
}

async function handleToolSuspended(
  state: PromptState,
  connection: AgentSideConnection,
  harness: Harness,
  event: Extract<HarnessEvent, { type: 'tool_suspended' }>,
): Promise<void> {
  const { toolCallId, toolName, args, suspendPayload } = event;

  // Auto-resolve certain suspensions (mirrors headless.ts autoResolve)
  if (toolName === 'request_access' || (suspendPayload as any)?.kind === 'sandbox_access_request') {
    harness.respondToToolSuspension({ toolCallId, resumeData: 'Yes' });
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
      const action = resp.outcome.outcome === 'selected' && resp.outcome.optionId === 'approve'
        ? 'approved'
        : 'rejected';
      harness.respondToToolSuspension({ toolCallId, resumeData: { action } });
    } catch {
      harness.respondToToolSuspension({ toolCallId, resumeData: { action: 'rejected' } });
    }
    return;
  }

  // For ask_user and other suspensions, auto-resolve
  harness.respondToToolSuspension({
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
