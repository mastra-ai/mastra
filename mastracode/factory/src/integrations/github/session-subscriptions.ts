import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type {
  ProjectRepository,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
} from '../../storage/domains/source-control/base';
import type { GithubIntegration } from './integration';
import { subscribeToPullRequest, unsubscribeFromPullRequest } from './subscriptions';

type RepositorySessionState = { factoryProjectId?: string; projectRepositoryId?: string };

/**
 * Minimal shape of the host-authenticated user placed on the request context
 * under the `user` key. Mirrors the host's auth user without importing it:
 * `workosId` (stable external id) wins over the row `id`, and `organizationId`
 * scopes org tenancy.
 */
interface SessionAuthUser {
  workosId?: string;
  id?: string;
  organizationId?: string;
}

function sessionUserId(user: SessionAuthUser | undefined): string | undefined {
  return user?.workosId ?? user?.id;
}

function sessionOrgId(user: SessionAuthUser | undefined): string | undefined {
  return user?.organizationId;
}

const pullRequestInputSchema = z.object({
  pullRequest: z.union([z.number().int().positive(), z.string().min(1)]),
});

interface SessionTarget {
  context: AgentControllerRequestContext<RepositorySessionState>;
  projectRepository: ProjectRepository;
  connection: ProjectSourceControlConnection;
  installation: SourceControlInstallation;
  repository: SourceControlRepository;
  orgId: string;
  userId: string;
}

function parsePullRequest(value: number | string, expectedRepo: string): number {
  if (typeof value === 'number') return value;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/i);
  if (!match || match[1]!.toLowerCase() !== expectedRepo.toLowerCase()) {
    throw new Error(`Pull request must belong to ${expectedRepo}.`);
  }
  return Number(match[2]);
}

/**
 * Whether the current request comes from a session that GitHub subscriptions
 * can ever apply to: an authenticated org user on a GitHub-project session
 * with an active thread. Mirrors the gate in `resolveSessionTarget` without
 * throwing, for passive callers that should no-op instead of erroring.
 */
function isGithubProjectSession(requestContext: RequestContext): boolean {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const user = requestContext.get('user') as SessionAuthUser | undefined;
  return Boolean(
    context?.threadId && context.getState().projectRepositoryId && sessionOrgId(user) && sessionUserId(user),
  );
}

async function resolveSessionTarget(requestContext: RequestContext, github: GithubIntegration): Promise<SessionTarget> {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const user = requestContext.get('user') as SessionAuthUser | undefined;
  const orgId = sessionOrgId(user);
  const userId = sessionUserId(user);
  const projectRepositoryId = context?.getState().projectRepositoryId;
  if (!context || !context.threadId || !projectRepositoryId || !orgId || !userId) {
    throw new Error('GitHub subscriptions require an authenticated repository session with an active thread.');
  }

  const projectRepository = await github.sourceControlStorage.projectRepositories.get({
    orgId,
    id: projectRepositoryId,
  });
  if (!projectRepository) throw new Error('Project repository not found for this organization.');
  const connection = await github.sourceControlStorage.connections.get({ orgId, id: projectRepository.connectionId });
  if (!connection) throw new Error('Source-control connection not found for this organization.');
  const repository = await github.sourceControlStorage.repositories.get({ orgId, id: projectRepository.repositoryId });
  if (!repository) throw new Error('Repository not found for this organization.');
  const installation = await github.sourceControlStorage.installations.get({ orgId, id: connection.installationId });
  if (!installation) throw new Error('Source-control installation not found for this organization.');
  return { context, projectRepository, connection, installation, repository, orgId, userId };
}

async function verifyPullRequest(target: SessionTarget, pullRequest: number, github: GithubIntegration) {
  const [owner, repo] = target.repository.slug.split('/');
  if (!owner || !repo) throw new Error('GitHub repository is invalid.');
  const octokit = github.getInstallationOctokit(Number(target.installation.externalId));
  const { data } = await octokit.pulls.get({ owner, repo, pull_number: pullRequest });
  if (String(data.base.repo.id) !== target.repository.externalId)
    throw new Error('Pull request repository does not match the active project repository.');
}

async function subscriptionInput(target: SessionTarget, pullRequestNumber: number) {
  return {
    orgId: target.orgId,
    installationExternalId: target.installation.externalId,
    projectRepositoryId: target.projectRepository.id,
    repositoryExternalId: target.repository.externalId,
    repositorySlug: target.repository.slug,
    changeRequestId: String(pullRequestNumber),
    sessionId: target.context.session.id,
    ownerId: target.context.session.ownerId,
    resourceId: target.connection.factoryProjectId,
    threadId: target.context.threadId!,
    sessionScope: target.context.scope,
    source: 'explicit-tool' as const,
    subscribedByUserId: target.userId,
  };
}

export async function subscribeCurrentSessionToPullRequest(
  requestContext: RequestContext,
  pullRequest: number | string,
  source: 'auto-gh-pr-create' | 'explicit-tool',
  github: GithubIntegration,
) {
  // The auto path observes every successful `gh pr create` in every session,
  // including local and non-GitHub-project sessions where subscriptions can
  // never apply. Skip silently there; only the explicit tool should surface
  // "this session cannot subscribe" as an error.
  if (source === 'auto-gh-pr-create' && !isGithubProjectSession(requestContext)) return undefined;
  const target = await resolveSessionTarget(requestContext, github);
  const number = parsePullRequest(pullRequest, target.repository.slug);
  await verifyPullRequest(target, number, github);
  await subscribeToPullRequest({ ...(await subscriptionInput(target, number)), source }, github.integrationStorage);
  return number;
}

export async function unsubscribeCurrentSessionFromPullRequest(
  requestContext: RequestContext,
  pullRequest: number | string,
  github: GithubIntegration,
) {
  const target = await resolveSessionTarget(requestContext, github);
  const number = parsePullRequest(pullRequest, target.repository.slug);
  await unsubscribeFromPullRequest(await subscriptionInput(target, number), github.integrationStorage);
  return number;
}

export function createGithubSubscriptionTools(requestContext: RequestContext, github: GithubIntegration) {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const user = requestContext.get('user') as SessionAuthUser | undefined;
  if (!context?.getState().projectRepositoryId || !sessionOrgId(user) || !sessionUserId(user)) return {};

  return {
    github_subscribe_pr: createTool({
      id: 'github_subscribe_pr',
      description:
        'Subscribe this thread to GitHub pull request activity. You usually do not need this tool: successful gh pr create commands subscribe automatically. Use it for an existing PR or to recover when automatic subscription did not occur. Closed or merged PRs are unsubscribed automatically. Accepts a PR number or canonical URL for the active project.',
      inputSchema: pullRequestInputSchema,
      execute: async ({ pullRequest }) => {
        const number = await subscribeCurrentSessionToPullRequest(requestContext, pullRequest, 'explicit-tool', github);
        return { subscribed: true, pullRequestNumber: number };
      },
    }),
    github_unsubscribe_pr: createTool({
      id: 'github_unsubscribe_pr',
      description:
        'Manually unsubscribe this thread from GitHub pull request activity. You usually do not need this tool because closed or merged PRs are unsubscribed automatically. Use it to stop notifications before then. Accepts a PR number or canonical URL for the active project.',
      inputSchema: pullRequestInputSchema,
      execute: async ({ pullRequest }) => {
        const number = await unsubscribeCurrentSessionFromPullRequest(requestContext, pullRequest, github);
        return { subscribed: false, pullRequestNumber: number };
      },
    }),
  };
}

export function stripHeredocBodies(command: string): string {
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

export function parseCreatedPullRequest(context: {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
}) {
  if (context.toolName !== 'execute_command' || context.error) return undefined;
  const command = (context.input as { command?: unknown } | undefined)?.command;
  if (
    typeof command !== 'string' ||
    !/(?:^|\n|;|&&|\|\|)\s*gh\s+pr\s+create(?:\s|$)/.test(stripHeredocBodies(command))
  ) {
    return undefined;
  }
  const output = context.output as { stdout?: unknown; result?: unknown } | undefined;
  const stdout = typeof context.output === 'string' ? context.output : (output?.stdout ?? output?.result);
  if (typeof stdout !== 'string') return undefined;
  const urls = stdout.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/g) ?? [];
  return urls.length === 1 ? urls[0] : undefined;
}
