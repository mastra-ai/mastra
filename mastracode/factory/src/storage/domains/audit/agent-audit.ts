/**
 * Git and GitHub actions performed by agents inside runs never touch web routes,
 * so this observer detects their externally-visible side effects in the command
 * and delegates recording to the factory-owned audit domain.
 */

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { AuditAgentEmitter } from './domain.js';

type FactorySessionState = { factoryProjectId?: string; projectRepositoryId?: string };

interface ToolObserverContext {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
  context: RequestContext;
}

/** Match command-start positions while ignoring command text embedded in heredoc bodies. */
const GIT_COMMIT_RE = /(?:^|\n|;|&&|\|\|)\s*git\s+commit(?:\s|$)/;
const GIT_PUSH_RE = /(?:^|\n|;|&&|\|\|)\s*git\s+push(?:\s|$)/;
const GH_PR_CREATE_RE = /^\s*gh\s+pr\s+create(?:\s|$)/;
/** `gh pr create` prints the new pull request URL alone on the last line, and nothing else does. */
const CREATED_PULL_REQUEST_URL_RE = /^https:\/\/\S+\/pull\/\d+$/;

function stripHeredocBodies(command: string): string {
  const lines = command.split('\n');
  const executableLines: string[] = [];
  let delimiter: string | undefined;

  for (const line of lines) {
    if (delimiter) {
      if (line.trim() === delimiter) delimiter = undefined;
      continue;
    }
    executableLines.push(line);
    const heredoc = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    delimiter = heredoc?.[2];
  }

  return executableLines.join('\n');
}

/** Only the command a chain ends on can have printed the last line of the output. */
function endsWithPullRequestCreate(command: string): boolean {
  const lastCommand = command
    .split(/;|&&|\|\||\n/)
    .filter(segment => segment.trim() !== '')
    .at(-1);
  return lastCommand !== undefined && GH_PR_CREATE_RE.test(lastCommand);
}

/**
 * The pull request `gh pr create` actually opened, or nothing. A command that
 * printed no URL created no pull request: `--dry-run` prints a preview, `--web`
 * prints a `/compare/` link, and a failure prints its exit code last.
 */
function createdPullRequestUrl(output: unknown): string | undefined {
  if (typeof output !== 'string') return undefined;
  const lastLine = output.trimEnd().split('\n').at(-1)?.trim();
  return lastLine !== undefined && CREATED_PULL_REQUEST_URL_RE.test(lastLine) ? lastLine : undefined;
}

/** Parse the branch from a plain `git push <remote> <branch>` invocation. */
function parsePushedBranch(command: string): string | undefined {
  const match = command.match(
    /(?:^|\n|;|&&|\|\|)\s*git\s+push\s+(?:-[^\s]+\s+)*([^\s;&|-][^\s;&|]*)\s+([^\s;&|-][^\s;&|]*)/,
  );
  return match?.[2];
}

/**
 * Detect externally-visible git and GitHub side effects in a completed tool
 * call and record `factory.agent.*` audit events for them. One command can emit
 * multiple events (`git commit && git push` emits both). Never throws.
 */
export async function observeAgentGitAction({
  audit,
  toolContext,
}: {
  audit: AuditAgentEmitter;
  toolContext: ToolObserverContext;
}): Promise<void> {
  try {
    if (toolContext.toolName !== 'execute_command' || toolContext.error) return;
    const rawCommand = (toolContext.input as { command?: unknown } | undefined)?.command;
    if (typeof rawCommand !== 'string') return;
    const command = stripHeredocBodies(rawCommand);

    const controller = toolContext.context.get('controller') as
      | AgentControllerRequestContext<FactorySessionState>
      | undefined;
    const worktreePath = controller?.scope;
    const targets = worktreePath ? [{ type: 'worktree', id: worktreePath }] : [];

    if (GIT_COMMIT_RE.test(command)) {
      await audit.emitAgent({
        requestContext: toolContext.context,
        input: { action: 'factory.agent.commit', targets },
      });
    }

    if (GIT_PUSH_RE.test(command)) {
      const branch = parsePushedBranch(command);
      await audit.emitAgent({
        requestContext: toolContext.context,
        input: { action: 'factory.agent.push', targets, ...(branch ? { metadata: { branch } } : {}) },
      });
    }

    const pullRequestUrl = endsWithPullRequestCreate(command) ? createdPullRequestUrl(toolContext.output) : undefined;
    if (pullRequestUrl) {
      await audit.emitAgent({
        requestContext: toolContext.context,
        input: {
          action: 'factory.agent.pr_opened',
          targets: [{ type: 'pull_request', id: pullRequestUrl }, ...targets],
          metadata: { url: pullRequestUrl },
        },
      });
    }
  } catch (err) {
    console.warn('[Audit] Failed to observe agent git action', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
