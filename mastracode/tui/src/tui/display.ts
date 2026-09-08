/**
 * Display helpers for the TUI: error messages, info messages, notifications.
 */
import { randomUUID } from 'node:crypto';

import { Container, Text } from '@earendil-works/pi-tui';

import { parseError } from '@mastra/code-sdk/utils/errors';
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { insertChatComponentWithBoundarySpacing } from './chat-boundary-reconciliation.js';
import type { ChatSpacingKind } from './components/chat-spacing.js';
import type { NotificationMode, NotificationReason } from './notify.js';
import { sendNotification } from './notify.js';
import type { TUIState } from './state.js';
import { theme } from './theme.js';

class InfoMessageComponent extends Container {
  constructor(lines: Text[]) {
    super();
    for (const line of lines) {
      this.addChild(line);
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}

/**
 * Insert system output *above* an active inline prompt so async messages
 * (e.g. MCP startup logs, #21966) never push the prompt off-screen while it
 * still holds keyboard focus. Mirrors `getInsertIndexBeforeStreaming` in
 * handlers/om.ts. Falls back to a tail append when no prompt is active.
 */
function getInsertIndexBeforePrompt(state: TUIState): number {
  const anchor = state.activeInlineQuestion ?? state.activeInlinePlanApproval;
  if (anchor) {
    const idx = state.chatContainer.children.indexOf(anchor);
    if (idx >= 0) return idx;
  }
  return state.chatContainer.children.length;
}

export function showError(state: TUIState, message: string): void {
  const component = new InfoMessageComponent([new Text(theme.fg('error', `Error: ${message}`), 1, 0)]);
  insertChatComponentWithBoundarySpacing(state.chatContainer, component, getInsertIndexBeforePrompt(state));
  state.ui.requestRender();
}

export function showInfo(state: TUIState, message: string): void {
  const component = new InfoMessageComponent([new Text(theme.fg('muted', message), 1, 0)]);
  insertChatComponentWithBoundarySpacing(state.chatContainer, component, getInsertIndexBeforePrompt(state));
  state.ui.requestRender();
}

export function showFormattedError(
  state: TUIState,
  event:
    | {
        error: Error;
        errorType?: string;
        retryable?: boolean;
        retryDelay?: number;
        retryAttempt?: number;
        maxRetries?: number;
      }
    | Error,
): void {
  const error = 'error' in event ? event.error : event;
  const parsed = parseError(error);

  // Show the main error message
  let errorText = `Error: ${parsed.message}`;
  if (parsed.detail && parsed.detail !== parsed.message) {
    errorText += theme.fg('muted', ` (${parsed.detail})`);
  }
  if (parsed.requestUrl) {
    errorText += theme.fg('muted', ` [url: ${parsed.requestUrl}]`);
  }

  // Retry timing is only shown when the controller explicitly scheduled a retry.
  const retryable = 'error' in event && event.retryable === true;
  const retryDelay = 'error' in event ? event.retryDelay : undefined;
  if (retryable && retryDelay) {
    const seconds = retryDelay / 1000;
    const retryAttempt = 'retryAttempt' in event ? event.retryAttempt : undefined;
    const maxRetries = 'maxRetries' in event ? event.maxRetries : undefined;
    const retryProgress = retryAttempt && maxRetries ? ` ${retryAttempt}/${maxRetries}` : '';
    errorText += theme.fg('muted', ` (retry${retryProgress} in ${seconds}s)`);
  }

  const lines: Text[] = [new Text(theme.fg('error', errorText), 1, 0)];

  const isObservationalMemoryError = /observational memory|\bOM (?:observation|reflection)/i.test(error.message);
  const omRole = /reflect/i.test(error.message) ? state.session.om.reflector : state.session.om.observer;
  const hint = withOMGuidance(getErrorHint(parsed.type), isObservationalMemoryError ? omRole.modelId() : undefined);
  if (hint) {
    lines.push(new Text(theme.fg('muted', `  Hint: ${hint}`), 1, 0));
  }

  const component = new InfoMessageComponent(lines);
  insertChatComponentWithBoundarySpacing(state.chatContainer, component, getInsertIndexBeforePrompt(state));
  state.ui.requestRender();
}

function withOMGuidance(typeHint: string | null, omModelId: string | undefined): string | null {
  if (!omModelId) return typeHint;
  return [`Observational Memory is using ${omModelId}`, typeHint, 'Use /memory to choose another OM model']
    .filter(Boolean)
    .join('. ');
}

function getErrorHint(errorType: string): string | null {
  switch (errorType) {
    case 'auth':
      return 'Use /connect to authenticate with a provider';
    case 'model_not_found':
      return 'Use /model to select a different model';
    case 'context_length':
      return 'Use /new to start a fresh conversation';
    case 'rate_limit':
      return 'Wait a moment and try again';
    case 'network':
      return 'Check your internet connection';
    default:
      return null;
  }
}

export function notify(state: TUIState, reason: NotificationReason, message?: string): void {
  const mode = ((state.session.state.get() as any)?.notifications ?? 'off') as NotificationMode;
  sendNotification(reason, {
    mode,
    message,
    hookManager: state.hookManager,
  });
}

/**
 * Fire the user-facing notification for an event the moment it is received,
 * before the event enters the TUI's serialized dispatch queue. A pending prompt
 * blocks that queue until the user answers, so any notify call living inside a
 * queued handler is starved exactly when the user has walked away. This helper
 * runs synchronously in the controller subscription listener instead.
 *
 * Covers two kinds of pings: input-request events (prompts that need the
 * user's answer, #20398) and the agent_done lifecycle ping when a run
 * finishes (#20860). The name predates the agent_end mapping and is kept for
 * continuity with the #20857 call sites and tests.
 *
 * All other events are a no-op. Never throws: a notification failure must not
 * break event delivery.
 */
export function notifyForInputRequest(state: TUIState, event: AgentControllerEvent): void {
  try {
    if (event.type === 'tool_approval_required') {
      notify(state, 'tool_approval', `Approve ${event.toolName}?`);
      return;
    }
    if (event.type === 'agent_end') {
      // A receipt-time agent_done means the run FINISHED, not that the TUI's
      // rendered state has caught up — the queued handler still does the
      // state work afterwards. Only 'complete' (or an absent reason) pings:
      // 'aborted'/'error' mirror the queued handlers, which never notified,
      // and 'suspended' must not ping because core emits tool_suspended
      // (which already pings above) followed by agent_end 'suspended' — the
      // old queued notify produced a spurious post-answer ping for it, which
      // this mapping deliberately removes.
      if (event.reason === 'complete' || event.reason === undefined) {
        notify(state, 'agent_done');
      }
      return;
    }
    if (event.type === 'tool_suspended') {
      const payload = (event.suspendPayload ?? {}) as Record<string, unknown>;
      // Sandbox check first, mirroring the dispatch routing order.
      if (event.toolName === 'request_access' || payload.kind === 'sandbox_access_request') {
        notify(state, 'sandbox_access', `Sandbox access requested: ${String(payload.path ?? '')}`);
      } else if (event.toolName === 'ask_user') {
        notify(state, 'ask_question', String(payload.question ?? ''));
      } else if (event.toolName === 'submit_plan') {
        const planPath = String(payload.path ?? '');
        notify(
          state,
          'plan_approval',
          planPath ? `Plan "${planPath}" requires approval` : 'Plan requires your approval',
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[notify error] ${msg}\n`);
  }
}

/**
 * Dispatch PermissionRequest hooks for a permission-prompt event the moment it
 * is received, before the event enters the TUI's serialized dispatch queue.
 * A pending prompt blocks that queue until the user answers, so a hook
 * dispatched from inside a queued handler is starved exactly when its external
 * integration needs to hear about the new prompt (#20861). This helper runs
 * synchronously in the controller subscription listener instead — the sibling
 * of notifyForInputRequest for hook dispatch rather than user pings.
 *
 * runId semantics: HookManager.runPermissionRequest silently bails when no run
 * id is set, and setRunId/clearRunId both run inside the QUEUED agent_start/
 * agent_end handling. To close the receipt-time gap — a permission event
 * arriving before its run's queued agent_start has been processed — agent_start
 * is handled here by setting the run id immediately (before the queued handler
 * runs). beginLifecycleRun() in the queued handler reuses an existing run id
 * instead of overwriting it, so the receipt-time id propagates to AgentStart
 * hooks and beyond.
 *
 * Never throws: a hook failure must not break event delivery.
 */
export function runPermissionHooksForEvent(state: TUIState, event: AgentControllerEvent): void {
  try {
    const hookMgr = state.hookManager;
    if (!hookMgr) return;
    if (event.type === 'agent_start') {
      // Set the run id at receipt time so subsequent permission events (e.g.
      // a tool_suspended for request_access arriving in the same synchronous
      // batch) have it available. beginLifecycleRun() reuses this id.
      if (!hookMgr.getRunId()) {
        hookMgr.setRunId(randomUUID());
      }
      return;
    }
    if (event.type === 'tool_approval_required') {
      hookMgr.runPermissionRequest('tool_approval', event.toolCallId, event.toolName, event.args).catch(() => {});
      return;
    }
    if (event.type === 'tool_suspended') {
      const payload = (event.suspendPayload ?? {}) as Record<string, unknown>;
      // Sandbox check first, mirroring the dispatch routing order.
      if (event.toolName === 'request_access' || payload.kind === 'sandbox_access_request') {
        hookMgr.runPermissionRequest('sandbox_access', event.toolCallId, event.toolName, payload).catch(() => {});
      } else if (event.toolName === 'submit_plan') {
        hookMgr.runPermissionRequest('plan_approval', event.toolCallId, event.toolName, payload).catch(() => {});
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[permission hook error] ${msg}\n`);
  }
}
