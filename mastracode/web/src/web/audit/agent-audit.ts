/**
 * Agent-level audit events (Audit v1.1).
 *
 * Git actions performed by agents inside runs never touch web routes, so the
 * `factory.git.*` events only capture human-initiated route calls. This module
 * closes that gap: `observeAgentGitAction` watches completed tool calls (via
 * the agent controller's postToolObserver) for externally-visible git side
 * effects — commits, pushes, and PR creation — and records them as
 * `factory.agent.*` audit events.
 *
 * Agent events are attributed to the run itself (`actor_id = 'agent:<threadId>'`,
 * `actor_type = 'agent'`) and chained back to the human who drove the run via
 * `metadata.startedBy`. Like all auditing, this never throws — failures are
 * logged with an `[Audit]` prefix and swallowed.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { WebAuthUser } from '../auth';
import { getWebAuthOrgId, getWebAuthUserId } from '../auth';
import { parseCreatedPullRequest, stripHeredocBodies } from '../github/session-subscriptions';
import type { AuditTarget } from '../storage/domains/audit/base';
import { recordAuditEvent } from './store';
import { forwardToWorkOS } from './workos-sink';

type GithubSessionState = { githubProjectId?: string };

export interface EmitAgentAuditInput {
  /** Dot-namespaced action, e.g. 'factory.agent.commit'. */
  action: string;
  targets: AuditTarget[];
  /** Bounded event summary — never full payloads, never secrets. */
  metadata?: Record<string, unknown>;
}

/**
 * Record an audit event for an action an agent performed inside a run. The
 * non-Hono sibling of `emitAudit`: the actor is the run's thread and the
 * initiating human is chained via `metadata.startedBy`. Silently no-ops when
 * the session context is incomplete; never throws.
 */
export async function emitAgentAudit(requestContext: RequestContext, input: EmitAgentAuditInput): Promise<void> {
  try {
    const context = requestContext.get('controller') as AgentControllerRequestContext<GithubSessionState> | undefined;
    const user = requestContext.get('user') as WebAuthUser | undefined;
    const orgId = getWebAuthOrgId(user);
    const userId = getWebAuthUserId(user);
    const threadId = context?.threadId;
    const githubProjectId = context?.getState().githubProjectId;
    if (!orgId || !userId || !threadId || !githubProjectId) return;

    const row = await recordAuditEvent({
      orgId,
      actorId: `agent:${threadId}`,
      actorType: 'agent',
      action: input.action,
      targets: input.targets,
      metadata: { ...input.metadata, startedBy: userId },
      githubProjectId,
      context: {},
    });
    if (row) void forwardToWorkOS(row);
  } catch (err) {
    console.warn('[Audit] Failed to emit agent audit event', {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

interface ToolObserverContext {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
  context: RequestContext;
}

/** Match command-start positions, same style as `parseCreatedPullRequest`. */
const GIT_COMMIT_RE = /(?:^|\n|;|&&|\|\|)\s*git\s+commit(?:\s|$)/;
const GIT_PUSH_RE = /(?:^|\n|;|&&|\|\|)\s*git\s+push(?:\s|$)/;
const GH_PR_CREATE_RE = /(?:^|\n|;|&&|\|\|)\s*gh\s+pr\s+create(?:\s|$)/;

/** Parse the branch from a plain `git push <remote> <branch>` invocation. */
function parsePushedBranch(command: string): string | undefined {
  const match = command.match(
    /(?:^|\n|;|&&|\|\|)\s*git\s+push\s+(?:-[^\s]+\s+)*([^\s;&|-][^\s;&|]*)\s+([^\s;&|-][^\s;&|]*)/,
  );
  return match?.[2];
}

/**
 * Detect externally-visible git side effects in a completed tool call and
 * record `factory.agent.*` audit events for them. One command can emit
 * multiple events (`git commit && git push` emits both). Never throws.
 */
export async function observeAgentGitAction(toolContext: ToolObserverContext): Promise<void> {
  try {
    if (toolContext.toolName !== 'execute_command' || toolContext.error) return;
    const rawCommand = (toolContext.input as { command?: unknown } | undefined)?.command;
    if (typeof rawCommand !== 'string') return;
    const command = stripHeredocBodies(rawCommand);

    const controller = toolContext.context.get('controller') as
      AgentControllerRequestContext<GithubSessionState> | undefined;
    const worktreePath = controller?.scope;

    if (GIT_COMMIT_RE.test(command)) {
      await emitAgentAudit(toolContext.context, {
        action: 'factory.agent.commit',
        targets: worktreePath ? [{ type: 'worktree', id: worktreePath }] : [],
      });
    }

    if (GIT_PUSH_RE.test(command)) {
      const branch = parsePushedBranch(command);
      await emitAgentAudit(toolContext.context, {
        action: 'factory.agent.push',
        targets: worktreePath ? [{ type: 'worktree', id: worktreePath }] : [],
        ...(branch ? { metadata: { branch } } : {}),
      });
    }

    if (GH_PR_CREATE_RE.test(command)) {
      const url = parseCreatedPullRequest(toolContext);
      await emitAgentAudit(toolContext.context, {
        action: 'factory.agent.pr_opened',
        targets: url ? [{ type: 'pull_request', id: url }] : [],
      });
    }
  } catch (err) {
    console.warn('[Audit] Failed to observe agent git action', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
