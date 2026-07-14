import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { WebAuthUser } from '../auth';
import { getWebAuthOrgId, getWebAuthUserId } from '../auth';
import { getInstallationOctokit } from './client';
import { getAppDb } from './db';
import { githubProjects } from './schema';
import { subscribeToPullRequest, unsubscribeFromPullRequest } from './subscriptions';

type GithubSessionState = { githubProjectId?: string };

const pullRequestInputSchema = z.object({
  pullRequest: z.union([z.number().int().positive(), z.string().min(1)]),
});

interface SessionTarget {
  context: AgentControllerRequestContext<GithubSessionState>;
  project: typeof githubProjects.$inferSelect;
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

async function resolveSessionTarget(requestContext: RequestContext): Promise<SessionTarget> {
  const context = requestContext.get('controller') as AgentControllerRequestContext<GithubSessionState> | undefined;
  const user = requestContext.get('user') as WebAuthUser | undefined;
  const orgId = getWebAuthOrgId(user);
  const userId = getWebAuthUserId(user);
  const githubProjectId = context?.getState().githubProjectId;
  if (!context || !context.threadId || !githubProjectId || !orgId || !userId) {
    throw new Error('GitHub subscriptions require an authenticated GitHub-project session with an active thread.');
  }

  const [project] = await getAppDb()
    .select()
    .from(githubProjects)
    .where(and(eq(githubProjects.id, githubProjectId), eq(githubProjects.orgId, orgId)));
  if (!project) throw new Error('GitHub project not found for this organization.');
  return { context, project, orgId, userId };
}

async function verifyPullRequest(target: SessionTarget, pullRequest: number) {
  const [owner, repo] = target.project.repoFullName.split('/');
  if (!owner || !repo) throw new Error('GitHub project repository is invalid.');
  const octokit = getInstallationOctokit(target.project.installationId);
  const { data } = await octokit.pulls.get({ owner, repo, pull_number: pullRequest });
  if (data.base.repo.id !== target.project.repoId) throw new Error('Pull request repository does not match the active project.');
}

async function subscriptionInput(target: SessionTarget, pullRequestNumber: number) {
  return {
    orgId: target.orgId,
    installationId: target.project.installationId,
    githubProjectId: target.project.id,
    repoId: target.project.repoId,
    pullRequestNumber,
    sessionId: target.context.session.id,
    ownerId: target.context.session.ownerId,
    resourceId: target.context.resourceId,
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
) {
  const target = await resolveSessionTarget(requestContext);
  const number = parsePullRequest(pullRequest, target.project.repoFullName);
  await verifyPullRequest(target, number);
  await subscribeToPullRequest({ ...(await subscriptionInput(target, number)), source });
  return number;
}

export async function unsubscribeCurrentSessionFromPullRequest(
  requestContext: RequestContext,
  pullRequest: number | string,
) {
  const target = await resolveSessionTarget(requestContext);
  const number = parsePullRequest(pullRequest, target.project.repoFullName);
  await unsubscribeFromPullRequest(await subscriptionInput(target, number));
  return number;
}

export function createGithubSubscriptionTools(requestContext: RequestContext) {
  const context = requestContext.get('controller') as AgentControllerRequestContext<GithubSessionState> | undefined;
  const user = requestContext.get('user') as WebAuthUser | undefined;
  if (!context?.getState().githubProjectId || !getWebAuthOrgId(user) || !getWebAuthUserId(user)) return {};

  return {
    github_subscribe_pr: createTool({
      id: 'github_subscribe_pr',
      description: 'Subscribe this thread to GitHub pull request activity. Accepts a PR number or canonical URL for the active project.',
      inputSchema: pullRequestInputSchema,
      execute: async ({ pullRequest }) => {
        const number = await subscribeCurrentSessionToPullRequest(requestContext, pullRequest, 'explicit-tool');
        return { subscribed: true, pullRequestNumber: number };
      },
    }),
    github_unsubscribe_pr: createTool({
      id: 'github_unsubscribe_pr',
      description: 'Unsubscribe this thread from GitHub pull request activity. Accepts a PR number or canonical URL for the active project.',
      inputSchema: pullRequestInputSchema,
      execute: async ({ pullRequest }) => {
        const number = await unsubscribeCurrentSessionFromPullRequest(requestContext, pullRequest);
        return { subscribed: false, pullRequestNumber: number };
      },
    }),
  };
}

export function parseCreatedPullRequest(context: { toolName: string; input: unknown; output?: unknown; error?: unknown }) {
  if (context.toolName !== 'execute_command' || context.error) return undefined;
  const command = (context.input as { command?: unknown } | undefined)?.command;
  if (typeof command !== 'string' || !/^\s*gh\s+pr\s+create(?:\s|$)/.test(command) || /(?:&&|\|\||[;|`])/.test(command)) {
    return undefined;
  }
  const output = context.output as { stdout?: unknown; result?: unknown } | undefined;
  const stdout = typeof context.output === 'string' ? context.output : (output?.stdout ?? output?.result);
  if (typeof stdout !== 'string') return undefined;
  const urls = stdout.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/g) ?? [];
  return urls.length === 1 ? urls[0] : undefined;
}
