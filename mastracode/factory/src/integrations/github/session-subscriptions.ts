import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../../auth.js';
import { findEnvironmentRepository, resolveSessionRepositories } from '../../session/environment-repositories.js';
import type { EnvironmentRepository } from '../../session/environment-repositories.js';
import { runsPullRequestCreate } from '../../session/shell-commands.js';
import type { SourceControlInstallation, SourceControlSession } from '../../storage/domains/source-control/base.js';
import type { IntegrationTools } from '../base.js';
import type { GithubIntegration } from './integration.js';
import { getGithubPat } from './pat.js';
import { subscribeToPullRequest, unsubscribeFromPullRequest } from './subscriptions.js';
import { getGithubRefreshTarget, getRegisteredGithubPatKind, requireGithubTokenInjector } from './token-refresh.js';

type RepositorySessionState = { factoryProjectId?: string };

/**
 * The host-authenticated user placed on the request context under the `user`
 * key, read through the host's own normalizer. A local mirror of that shape
 * used to live here; it silently missed the provider shapes the normalizer
 * knows about, which turned every subscription tool into a no-op for those
 * users instead of an error anybody could see.
 */
function sessionUserId(requestContext: RequestContext): string | undefined {
  return getFactoryAuthUserId(getFactoryAuthUserFromContext(requestContext));
}

function sessionOrgId(requestContext: RequestContext): string | undefined {
  return getFactoryAuthOrgId(getFactoryAuthUserFromContext(requestContext));
}

const pullRequestInputSchema = z.object({
  pullRequest: z.union([z.number().int().positive(), z.string().min(1)]),
});

const TRIAGE_COMMENT_MARKER = '<!-- mastra-factory-triage -->';
const triageCommentInputSchema = z.object({
  issueNumber: z.number().int().positive(),
  body: z.string().startsWith(TRIAGE_COMMENT_MARKER),
});

const triageCommentLocks = new Map<string, Promise<void>>();

async function serializeTriageComment<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = triageCommentLocks.get(key) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  triageCommentLocks.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release!();
    if (triageCommentLocks.get(key) === queued) triageCommentLocks.delete(key);
  }
}

/**
 * The session a subscription request comes from: its factory row when the
 * session was created through a factory entry point (null for a controller
 * session that only carries `factoryProjectId`), and every repository it may
 * target, the environment list plus its own link.
 */
interface SessionTarget {
  context: AgentControllerRequestContext<RepositorySessionState>;
  session: SourceControlSession | null;
  repositories: EnvironmentRepository[];
  orgId: string;
  userId: string;
}

/** One pull request of one environment repository, with the installation that reaches it. */
interface PullRequestTarget extends EnvironmentRepository {
  installation: SourceControlInstallation;
  number: number;
}

const PULL_REQUEST_URL = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\/?$/i;

function parsePullRequest(value: string): { slug: string; number: number } | undefined {
  const match = value.trim().match(PULL_REQUEST_URL);
  return match ? { slug: match[1]!, number: Number(match[2]) } : undefined;
}

/** The link the session is filed under, when the environment still carries it. */
function ownRepository(target: SessionTarget): EnvironmentRepository | undefined {
  const ownId = target.session?.projectRepositoryId;
  return ownId ? target.repositories.find(candidate => candidate.link.id === ownId) : undefined;
}

/**
 * Whether the current request comes from a session that GitHub subscriptions
 * can ever apply to: an authenticated org user on a factory session with an
 * active thread. Mirrors the gate in `resolveSessionTarget` without throwing,
 * for passive callers that should no-op instead of erroring.
 */
function isGithubProjectSession(requestContext: RequestContext): boolean {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  return Boolean(
    context?.threadId &&
    context.getState().factoryProjectId &&
    sessionOrgId(requestContext) &&
    sessionUserId(requestContext),
  );
}

async function resolveSessionTarget(requestContext: RequestContext, github: GithubIntegration): Promise<SessionTarget> {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const orgId = sessionOrgId(requestContext);
  const userId = sessionUserId(requestContext);
  const factoryProjectId = context?.getState().factoryProjectId;
  if (!context || !context.threadId || !factoryProjectId || !orgId || !userId) {
    throw new Error('GitHub subscriptions require an authenticated repository session with an active thread.');
  }
  const sourceControl = github.sourceControlStorage;
  const session = await sourceControl.sessions.getBySessionId(context.resourceId);
  if (session && (session.orgId !== orgId || (session.factoryProjectId && session.factoryProjectId !== factoryProjectId))) {
    throw new Error('The active session does not belong to this Factory.');
  }
  const repositories = await resolveSessionRepositories({
    sourceControl,
    session: session ?? { orgId, factoryProjectId, projectRepositoryId: null },
  });
  return { context, session, repositories, orgId, userId };
}

/**
 * The environment repository a pull request reference names. A canonical URL
 * resolves against every repository the session may target; a bare number
 * only against the link the session is filed under.
 */
async function resolvePullRequest(
  target: SessionTarget,
  value: number | string,
  github: GithubIntegration,
): Promise<PullRequestTarget> {
  let repository: EnvironmentRepository | undefined;
  let number: number;
  if (typeof value === 'number' || /^\d+$/.test(value.trim())) {
    repository = ownRepository(target);
    if (!repository) {
      throw new Error('Pass the full pull request URL: this session is not filed under a single repository.');
    }
    number = Number(value);
  } else {
    const parsed = parsePullRequest(value);
    if (!parsed) throw new Error('Pull request must be a number or a canonical GitHub pull request URL.');
    repository = findEnvironmentRepository(target.repositories, parsed.slug);
    if (!repository) throw new Error(`Pull request ${value.trim()} is not in a repository linked to this Factory.`);
    number = parsed.number;
  }
  const installation = await github.sourceControlStorage.installations.get({
    orgId: target.orgId,
    id: repository.connection.installationId,
  });
  if (!installation) throw new Error('Source-control installation not found for this organization.');
  return { ...repository, installation, number };
}

/** Confirm the pull request lives in the repository its reference named; returns its head ref. */
async function verifyPullRequest(pullRequest: PullRequestTarget, github: GithubIntegration): Promise<string> {
  const [owner, repo] = pullRequest.repository.slug.split('/');
  if (!owner || !repo) throw new Error('GitHub repository is invalid.');
  const octokit = github.getInstallationOctokit(Number(pullRequest.installation.externalId));
  const { data } = await octokit.pulls.get({ owner, repo, pull_number: pullRequest.number });
  if (String(data.base.repo.id) !== pullRequest.repository.externalId)
    throw new Error('Pull request repository does not match the active project repository.');
  return data.head.ref;
}

function subscriptionInput(target: SessionTarget, pullRequest: PullRequestTarget) {
  return {
    orgId: target.orgId,
    installationExternalId: pullRequest.installation.externalId,
    projectRepositoryId: pullRequest.link.id,
    repositoryExternalId: pullRequest.repository.externalId,
    repositorySlug: pullRequest.repository.slug,
    changeRequestId: String(pullRequest.number),
    sessionId: target.context.session.id,
    ownerId: target.context.session.ownerId,
    resourceId: pullRequest.connection.factoryProjectId,
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
  // A URL outside the environment on the auto path is the agent opening a PR
  // somewhere this Factory does not follow: observed, never subscribed.
  if (source === 'auto-gh-pr-create' && typeof pullRequest === 'string') {
    const parsed = parsePullRequest(pullRequest);
    if (parsed && !findEnvironmentRepository(target.repositories, parsed.slug)) {
      console.warn("[GitHub] Pull request URL is not in this Factory's environment; not subscribing", {
        url: pullRequest.trim(),
      });
      return undefined;
    }
  }
  const resolved = await resolvePullRequest(target, pullRequest, github);
  const headRef = await verifyPullRequest(resolved, github);
  await subscribeToPullRequest({ ...subscriptionInput(target, resolved), source }, github.integrationStorage);
  // The session-repository row is the per-repository record of what this
  // session opened; an existing row keeps the branch its push wrote.
  if (target.session) {
    await github.sourceControlStorage.sessionRepositories.upsert({
      sessionId: target.session.sessionId,
      projectRepositoryId: resolved.link.id,
      changeRequestId: String(resolved.number),
      changeRequestUrl: `https://github.com/${resolved.repository.slug}/pull/${resolved.number}`,
      fallbackBranch: headRef,
    });
  }
  return resolved.number;
}

export async function unsubscribeCurrentSessionFromPullRequest(
  requestContext: RequestContext,
  pullRequest: number | string,
  github: GithubIntegration,
) {
  const target = await resolveSessionTarget(requestContext, github);
  const resolved = await resolvePullRequest(target, pullRequest, github);
  await unsubscribeFromPullRequest(subscriptionInput(target, resolved), github.integrationStorage);
  return resolved.number;
}

export async function upsertFactoryTriageComment(
  requestContext: RequestContext,
  input: { issueNumber: number; body: string },
  github: GithubIntegration,
) {
  const target = await resolveSessionTarget(requestContext, github);
  const own = ownRepository(target);
  if (!own) throw new Error('The triage handoff needs a session filed under a single repository.');
  const installation = await github.sourceControlStorage.installations.get({
    orgId: target.orgId,
    id: own.connection.installationId,
  });
  if (!installation) throw new Error('Source-control installation not found for this organization.');
  const installationId = Number(installation.externalId);
  if (!Number.isSafeInteger(installationId) || installationId <= 0) throw new Error('GitHub installation is invalid.');
  return serializeTriageComment(`${installationId}:${own.repository.externalId}:${input.issueNumber}`, () =>
    github.upsertFactoryTriageComment({
      installationId,
      repository: own.repository.slug,
      issueNumber: input.issueNumber,
      body: input.body,
    }),
  );
}

export async function refreshGithubToken(requestContext: RequestContext, github: GithubIntegration): Promise<void> {
  const inject = requireGithubTokenInjector(requestContext);
  // The workspace resolver records the target only after authorizing the
  // caller against the GitHub-backed session that owns this sandbox.
  const target = getGithubRefreshTarget(requestContext);
  if (!target) throw new Error('The active session is not backed by a GitHub workspace.');
  // `GH_TOKEN` feeds the `gh` CLI, so a configured org PAT wins over a minted
  // installation token (which 403s on integration-restricted endpoints). The
  // workspace records which PAT kind the sandbox was provisioned with, so a
  // review-board sandbox keeps its reviewer token on refresh.
  const pat = await getGithubPat(
    () => github.integrationStorage,
    target.orgId,
    getRegisteredGithubPatKind(requestContext),
  );
  if (pat) {
    inject(pat);
    return;
  }
  // The boot's own minter keeps the environment scope (and the agent's note
  // about it) in step with what `gh` reaches after a refresh.
  if (target.mint) {
    inject(await target.mint());
    return;
  }
  const access = await github.versionControl.getRepositoryAccess({
    orgId: target.orgId,
    repositoryId: target.repositoryId,
  });
  const token = access.authorization?.token;
  if (!token) throw new Error('Repository access did not include a bearer token for the Factory session.');
  inject(token);
}

export function createGithubSubscriptionTools(requestContext: RequestContext, github: GithubIntegration) {
  const tools: IntegrationTools = {};
  if (getGithubRefreshTarget(requestContext)) {
    tools.github_refresh_token = createTool({
      id: 'github_refresh_token',
      description:
        'Refresh GitHub CLI authentication in the active Factory sandbox. Use this after a gh command fails because authentication is expired, invalid, or missing. It installs a fresh GH_TOKEN for subsequent sandbox commands. After this tool succeeds, retry the failed gh command. Takes no arguments and never returns the token.',
      inputSchema: z.object({}),
      execute: async () => {
        await refreshGithubToken(requestContext, github);
        return { refreshed: true };
      },
    });
  }
  if (!isGithubProjectSession(requestContext)) return tools;

  return {
    ...tools,
    github_upsert_factory_triage_comment: createTool({
      id: 'github_upsert_factory_triage_comment',
      description:
        'Create or update this Factory App’s canonical triage handoff comment on an issue in the active repository. Use this for every marked pending or final Factory triage handoff; never use gh to create or edit that handoff.',
      inputSchema: triageCommentInputSchema,
      execute: async input => upsertFactoryTriageComment(requestContext, input, github),
    }),
    github_subscribe_pr: createTool({
      id: 'github_subscribe_pr',
      description:
        'Subscribe this thread to GitHub pull request activity. You usually do not need this tool: successful gh pr create commands subscribe automatically. Use it for an existing PR or to recover when automatic subscription did not occur. Closed or merged PRs are unsubscribed automatically. Accepts a canonical PR URL for any repository in this Factory; a bare PR number only when this session is filed under a single repository, so pass the URL when the Factory has more than one.',
      inputSchema: pullRequestInputSchema,
      execute: async ({ pullRequest }) => {
        const number = await subscribeCurrentSessionToPullRequest(requestContext, pullRequest, 'explicit-tool', github);
        return { subscribed: true, pullRequestNumber: number };
      },
    }),
    github_unsubscribe_pr: createTool({
      id: 'github_unsubscribe_pr',
      description:
        'Manually unsubscribe this thread from GitHub pull request activity. You usually do not need this tool because closed or merged PRs are unsubscribed automatically. Use it to stop notifications before then. Accepts a canonical PR URL for any repository in this Factory, or a bare PR number when this session is filed under a single repository.',
      inputSchema: pullRequestInputSchema,
      execute: async ({ pullRequest }) => {
        const number = await unsubscribeCurrentSessionFromPullRequest(requestContext, pullRequest, github);
        return { subscribed: false, pullRequestNumber: number };
      },
    }),
  };
}

const GITHUB_PULL_REQUEST_URL = /^https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+\/?$/;

export function parseCreatedPullRequest(context: {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
}) {
  if (context.error) return undefined;
  // The provider-neutral change-request tool reports the created PR directly;
  // subscribe on it exactly as on a successful `gh pr create`.
  if (context.toolName === 'source_control_create_change_request') {
    const url = (context.output as { url?: unknown } | undefined)?.url;
    return typeof url === 'string' && GITHUB_PULL_REQUEST_URL.test(url) ? url.replace(/\/$/, '') : undefined;
  }
  if (context.toolName !== 'execute_command') return undefined;
  const command = (context.input as { command?: unknown } | undefined)?.command;
  if (typeof command !== 'string' || !runsPullRequestCreate(command)) return undefined;
  const output = context.output as { stdout?: unknown; result?: unknown } | undefined;
  const stdout = typeof context.output === 'string' ? context.output : (output?.stdout ?? output?.result);
  if (typeof stdout !== 'string') return undefined;
  const urls = stdout.match(/https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/g) ?? [];
  return urls.length === 1 ? urls[0] : undefined;
}
