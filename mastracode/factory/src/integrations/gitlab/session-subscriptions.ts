import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../../auth.js';
import type {
  ProjectRepository,
  ProjectSourceControlConnection,
  SourceControlInstallation,
  SourceControlRepository,
} from '../../storage/domains/source-control/base.js';
import type { GitLabIntegrationBase } from './integration.js';
import { normalizeGitLabHost } from './integration.js';
import { subscribeToMergeRequest, unsubscribeFromMergeRequest } from './subscriptions.js';
import type { GitLabSignalSubscriptionSource } from './subscriptions.js';

type RepositorySessionState = { factoryProjectId?: string; projectRepositoryId?: string };

const MERGE_REQUEST_URL = /^https?:\/\/([^/\s]+)\/(.+?)\/-\/merge_requests\/(\d+)\/?$/i;

function sessionUserId(requestContext: RequestContext): string | undefined {
  return getFactoryAuthUserId(getFactoryAuthUserFromContext(requestContext));
}

function sessionOrgId(requestContext: RequestContext): string | undefined {
  return getFactoryAuthOrgId(getFactoryAuthUserFromContext(requestContext));
}

const mergeRequestInputSchema = z.object({
  mergeRequest: z.union([z.number().int().positive(), z.string().min(1)]),
});

interface SessionTarget {
  context: AgentControllerRequestContext<RepositorySessionState>;
  projectRepository: ProjectRepository;
  connection: ProjectSourceControlConnection;
  installation: SourceControlInstallation;
  repository: SourceControlRepository;
  host: string;
  orgId: string;
  userId: string;
}

function normalizePath(value: string): string {
  return value.replace(/^\/+|\/+$/g, '').toLowerCase();
}

export function parseMergeRequestUrl(url: string): { host: string; projectPath: string; iid: number } | undefined {
  const match = url.trim().match(MERGE_REQUEST_URL);
  if (!match) return undefined;
  const iid = Number(match[3]);
  if (!Number.isSafeInteger(iid) || iid < 1) return undefined;
  return { host: normalizeGitLabHost(match[1]!), projectPath: match[2]!.replace(/\/+$/, ''), iid };
}

function parseMergeRequest(value: number | string, target: SessionTarget): number {
  if (typeof value === 'number') return value;
  if (/^\d+$/.test(value)) return Number(value);
  const parsed = parseMergeRequestUrl(value);
  if (
    !parsed ||
    parsed.host !== target.host ||
    normalizePath(parsed.projectPath) !== normalizePath(target.repository.slug)
  ) {
    throw new Error(`Merge request must belong to ${target.host}/${target.repository.slug}.`);
  }
  return parsed.iid;
}

/**
 * Whether the current request comes from a session that merge-request
 * subscriptions can ever apply to: an authenticated org user on a repository
 * session with an active thread. Mirrors the GitHub gate; whether the
 * repository is GitLab-linked is only known after a storage read, so the
 * entry points verify that and fail loudly for the explicit tools.
 */
function isRepositorySession(requestContext: RequestContext): boolean {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  return Boolean(
    context?.threadId &&
    context.getState().projectRepositoryId &&
    sessionOrgId(requestContext) &&
    sessionUserId(requestContext),
  );
}

async function resolveSessionTarget(
  requestContext: RequestContext,
  gitlab: GitLabIntegrationBase,
): Promise<SessionTarget | undefined> {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const orgId = sessionOrgId(requestContext);
  const userId = sessionUserId(requestContext);
  const projectRepositoryId = context?.getState().projectRepositoryId;
  if (!context || !context.threadId || !projectRepositoryId || !orgId || !userId) {
    throw new Error('GitLab subscriptions require an authenticated repository session with an active thread.');
  }
  const storage = gitlab.sourceControlStorage;
  if (!storage) throw new Error('GitLab source control is unavailable.');

  // The handle is scoped to GitLab rows, so a GitHub-linked repository is
  // simply absent here rather than misidentified.
  const projectRepository = await storage.projectRepositories.get({ orgId, id: projectRepositoryId });
  if (!projectRepository) return undefined;
  const connection = await storage.connections.get({ orgId, id: projectRepository.connectionId });
  if (!connection || connection.integrationId !== 'gitlab') return undefined;
  const repository = await storage.repositories.get({ orgId, id: projectRepository.repositoryId });
  if (!repository) throw new Error('Repository not found for this organization.');
  const installation = await storage.installations.get({ orgId, id: connection.installationId });
  if (!installation) throw new Error('Source-control installation not found for this organization.');
  const host = installation.providerMetadata.host;
  if (typeof host !== 'string' || !host) throw new Error('GitLab installation is missing its instance host.');
  return {
    context,
    projectRepository,
    connection,
    installation,
    repository,
    host: normalizeGitLabHost(host),
    orgId,
    userId,
  };
}

async function requireGitLabSessionTarget(
  requestContext: RequestContext,
  gitlab: GitLabIntegrationBase,
): Promise<SessionTarget> {
  const target = await resolveSessionTarget(requestContext, gitlab);
  if (!target) throw new Error('The active session is not backed by a GitLab repository.');
  return target;
}

async function verifyMergeRequest(target: SessionTarget, iid: number, gitlab: GitLabIntegrationBase): Promise<void> {
  const repositoryTarget = await gitlab.versionControl.getRepositoryTarget({
    orgId: target.orgId,
    repositoryId: target.repository.id,
  });
  const mergeRequest = await gitlab.versionControl.getPullRequest({ ...repositoryTarget, pullRequestId: String(iid) });
  if (!mergeRequest) throw new Error(`Merge request !${iid} was not found in ${target.repository.slug}.`);
  const parsed = parseMergeRequestUrl(mergeRequest.url);
  if (
    parsed &&
    (parsed.host !== target.host || normalizePath(parsed.projectPath) !== normalizePath(target.repository.slug))
  ) {
    throw new Error('Merge request project does not match the active project repository.');
  }
}

function subscriptionInput(target: SessionTarget, iid: number) {
  return {
    orgId: target.orgId,
    host: target.host,
    projectId: target.repository.externalId,
    projectPath: target.repository.slug,
    projectRepositoryId: target.projectRepository.id,
    installationExternalId: target.installation.externalId,
    changeRequestId: String(iid),
    sessionId: target.context.session.id,
    ownerId: target.context.session.ownerId,
    resourceId: target.connection.factoryProjectId,
    threadId: target.context.threadId!,
    sessionScope: target.context.scope,
    source: 'explicit-tool' as GitLabSignalSubscriptionSource,
    subscribedByUserId: target.userId,
  };
}

export async function subscribeCurrentSessionToMergeRequest(
  requestContext: RequestContext,
  mergeRequest: number | string,
  source: GitLabSignalSubscriptionSource,
  gitlab: GitLabIntegrationBase,
): Promise<number | undefined> {
  // The auto path observes every successful change-request creation in every
  // session, including GitHub-project sessions where a GitLab subscription can
  // never apply. Skip silently there; only the explicit tool should surface
  // "this session cannot subscribe" as an error.
  if (source === 'auto-create-change-request') {
    if (!isRepositorySession(requestContext)) return undefined;
    const target = await resolveSessionTarget(requestContext, gitlab);
    if (!target) return undefined;
    const iid = parseMergeRequest(mergeRequest, target);
    await verifyMergeRequest(target, iid, gitlab);
    await subscribeToMergeRequest({ ...subscriptionInput(target, iid), source }, gitlab.integrationStorage);
    return iid;
  }
  const target = await requireGitLabSessionTarget(requestContext, gitlab);
  const iid = parseMergeRequest(mergeRequest, target);
  await verifyMergeRequest(target, iid, gitlab);
  await subscribeToMergeRequest({ ...subscriptionInput(target, iid), source }, gitlab.integrationStorage);
  return iid;
}

export async function unsubscribeCurrentSessionFromMergeRequest(
  requestContext: RequestContext,
  mergeRequest: number | string,
  gitlab: GitLabIntegrationBase,
): Promise<number> {
  const target = await requireGitLabSessionTarget(requestContext, gitlab);
  const iid = parseMergeRequest(mergeRequest, target);
  await unsubscribeFromMergeRequest(subscriptionInput(target, iid), gitlab.integrationStorage);
  return iid;
}

export function createGitLabSubscriptionTools(requestContext: RequestContext, gitlab: GitLabIntegrationBase) {
  if (!isRepositorySession(requestContext)) return {};

  return {
    gitlab_subscribe_mr: createTool({
      id: 'gitlab_subscribe_mr',
      description:
        'Subscribe this thread to GitLab merge request activity. You usually do not need this tool: successful source_control_create_change_request calls subscribe automatically. Use it for an existing MR or to recover when automatic subscription did not occur. Closed or merged MRs are unsubscribed automatically. Accepts an MR IID or canonical URL for the active project.',
      inputSchema: mergeRequestInputSchema,
      execute: async ({ mergeRequest }) => {
        const iid = await subscribeCurrentSessionToMergeRequest(requestContext, mergeRequest, 'explicit-tool', gitlab);
        return { subscribed: true, mergeRequestIid: iid };
      },
    }),
    gitlab_unsubscribe_mr: createTool({
      id: 'gitlab_unsubscribe_mr',
      description:
        'Manually unsubscribe this thread from GitLab merge request activity. You usually do not need this tool because closed or merged MRs are unsubscribed automatically. Use it to stop notifications before then. Accepts an MR IID or canonical URL for the active project.',
      inputSchema: mergeRequestInputSchema,
      execute: async ({ mergeRequest }) => {
        const iid = await unsubscribeCurrentSessionFromMergeRequest(requestContext, mergeRequest, gitlab);
        return { subscribed: false, mergeRequestIid: iid };
      },
    }),
  };
}

/**
 * The merge request URL a successful provider-neutral change-request creation
 * reported, when that URL is a GitLab one. Anything else is not ours to observe.
 */
export function parseCreatedMergeRequest(context: {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
}): string | undefined {
  if (context.toolName !== 'source_control_create_change_request' || context.error) return undefined;
  const url = (context.output as { url?: unknown } | undefined)?.url;
  if (typeof url !== 'string' || !parseMergeRequestUrl(url)) return undefined;
  return url.trim().replace(/\/$/, '');
}
