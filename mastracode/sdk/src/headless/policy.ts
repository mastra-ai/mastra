/**
 * Resolution policies decide how `runMC` resumes interactive events
 * (`tool_approval_required`, `tool_suspended`) without a human in the loop.
 *
 * Policies are pure decision objects: they inspect the event and return a
 * decision. The runner is responsible for applying the decision to the session
 * and for any side effects (emitting labels, etc.). This keeps policies testable
 * and lets CI swap in stricter behavior without touching the runner.
 */
import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { PermissionMode, ResolutionPolicy } from './types.js';

/**
 * Default policy — reproduces the historical headless behavior:
 *  - approve every tool approval request,
 *  - auto-approve `request_access` / sandbox access suspensions ("Yes"),
 *  - auto-approve `submit_plan` suspensions (`{ action: 'approved' }`),
 *  - answer any other suspension with a "use your best judgment" instruction.
 */
export const autoApprovePolicy: ResolutionPolicy = {
  onToolApproval(_event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }>): 'approve' | 'deny' {
    return 'approve';
  },

  onSuspension(
    event: Extract<AgentControllerEvent, { type: 'tool_suspended' }>,
  ): { resumeData: unknown } | { abort: true } {
    const payload = (event.suspendPayload ?? {}) as Record<string, unknown>;

    if (event.toolName === 'request_access' || payload.kind === 'sandbox_access_request') {
      return { resumeData: 'Yes' };
    }

    if (event.toolName === 'submit_plan') {
      return { resumeData: { action: 'approved' } };
    }

    return { resumeData: 'Proceed with your best judgment. Do not ask further questions.' };
  },
};

/**
 * Strict policy — refuses every tool approval and aborts on any suspension.
 * Useful for CI gating where unattended tool execution must not happen.
 */
export const denyPolicy: ResolutionPolicy = {
  onToolApproval(_event: Extract<AgentControllerEvent, { type: 'tool_approval_required' }>): 'approve' | 'deny' {
    return 'deny';
  },

  onSuspension(
    _event: Extract<AgentControllerEvent, { type: 'tool_suspended' }>,
  ): { resumeData: unknown } | { abort: true } {
    return { abort: true };
  },
};

/** Resolve a named {@link PermissionMode} to its built-in {@link ResolutionPolicy}. */
export function permissionModeToPolicy(mode: PermissionMode): ResolutionPolicy {
  switch (mode) {
    case 'deny':
      return denyPolicy;
    case 'auto':
    default:
      return autoApprovePolicy;
  }
}
