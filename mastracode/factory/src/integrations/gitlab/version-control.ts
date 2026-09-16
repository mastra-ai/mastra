import type { IntegrationConnection } from '../../capabilities/connection.js';
import type { VersionControl } from '../../capabilities/version-control.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import { GitLabApiError } from './api.js';
import type { GitLabApiClient } from './api.js';

export interface GitLabVersionControlContext {
  api: GitLabApiClient;
  connection: IntegrationConnection;
  host: string;
}

export interface GitLabVersionControlDependencies {
  contextForConnection(connection: IntegrationConnection): Promise<GitLabVersionControlContext>;
}

export function buildGitLabVersionControl(deps: GitLabVersionControlDependencies): VersionControl {
  let storage: SourceControlStorageHandle | undefined;

  const sourceControlStorage = (): SourceControlStorageHandle => {
    if (!storage) throw new Error('GitLab VersionControl is not initialized.');
    return storage;
  };

  const notImplemented = (): never => {
    throw new GitLabApiError('GitLab version-control operation is not implemented.', 501);
  };

  return {
    initialize: input => {
      storage = input.storage;
    },
    registerInstallation: async ({ orgId, userId, installation }) => {
      const requestedConnection = parseConnection(installation.metadata?.connection);
      if (!requestedConnection) {
        throw new GitLabApiError('GitLab installation metadata must include a valid connection.', 400);
      }
      const context = await deps.contextForConnection(requestedConnection);
      return sourceControlStorage().installations.upsert({
        orgId,
        connectedByUserId: userId,
        externalId: installation.externalId,
        accountName: installation.accountName,
        accountType: installation.accountType,
        providerMetadata: {
          ...installation.metadata,
          connection: context.connection,
          host: normalizeHost(context.host),
        },
      });
    },
    registerRepositories: async ({ orgId, installationId, repositories }) =>
      await Promise.all(
        repositories.map(repository =>
          sourceControlStorage().repositories.upsert({
            orgId,
            input: {
              installationId,
              externalId: repository.externalId,
              slug: normalizeSlug(repository.slug),
              defaultBranch: repository.defaultBranch,
              providerMetadata: repository.metadata,
            },
          }),
        ),
      ),
    getRepositoryAccess: async ({ orgId, repositoryId }) => {
      const repository = await sourceControlStorage().repositories.get({ orgId, id: repositoryId });
      if (!repository) throw new Error('Version-control repository not found.');
      const installation = await sourceControlStorage().installations.get({
        orgId,
        id: repository.installationId,
      });
      if (!installation) throw new Error('Version-control installation not found.');
      const connection = parseConnection(installation.providerMetadata.connection);
      if (!connection) throw new GitLabApiError('GitLab installation connection metadata is invalid.', 500);
      const context = await deps.contextForConnection(connection);
      const token = accessToken(context.connection);
      const host = normalizeHost(context.host);
      const slug = normalizeSlug(repository.slug);
      return {
        cloneUrl: `https://${host}/${slug}.git`,
        authorization: { scheme: 'bearer', token },
      };
    },
    listPullRequests: notImplemented,
    getPullRequest: notImplemented,
    createPullRequest: notImplemented,
    updatePullRequest: notImplemented,
    closePullRequest: notImplemented,
    mergePullRequest: notImplemented,
    listComments: notImplemented,
    createComment: notImplemented,
    updateComment: notImplemented,
    deleteComment: notImplemented,
    listReviews: notImplemented,
    getReview: notImplemented,
    createReview: notImplemented,
    updateReview: notImplemented,
    submitReview: notImplemented,
    dismissReview: notImplemented,
    deletePendingReview: notImplemented,
    listReviewComments: notImplemented,
    createReviewComment: notImplemented,
    updateReviewComment: notImplemented,
    deleteReviewComment: notImplemented,
    listRequestedReviewers: notImplemented,
    requestReviewers: notImplemented,
    removeRequestedReviewers: notImplemented,
  };
}

export function tokenUrl(host: string, slug: string, token: string): string {
  const accessToken = token.trim();
  if (!accessToken) throw new Error('GitLab repository access token is missing.');
  return `https://oauth2:${accessToken}@${normalizeHost(host)}/${normalizeSlug(slug)}.git`;
}

function parseConnection(value: unknown): IntegrationConnection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const connection = value as Record<string, unknown>;
  if (connection.type === 'oauth' && typeof connection.accessToken === 'string' && connection.accessToken.length > 0) {
    return { type: 'oauth', accessToken: connection.accessToken };
  }
  if (
    connection.type === 'app-installation' &&
    Number.isSafeInteger(connection.installationId) &&
    Number(connection.installationId) > 0
  ) {
    return { type: 'app-installation', installationId: Number(connection.installationId) };
  }
  return null;
}

function accessToken(connection: IntegrationConnection): string {
  if (connection.type !== 'oauth' || !connection.accessToken) {
    throw new GitLabApiError('GitLab repository access requires an OAuth or personal access token.', 500);
  }
  return connection.accessToken;
}

function normalizeHost(value: string): string {
  const host = value.trim();
  if (!host || host.includes('/') || host.includes('@')) throw new GitLabApiError('GitLab host is invalid.', 400);
  let parsed: URL;
  try {
    parsed = new URL(`https://${host}`);
  } catch {
    throw new GitLabApiError('GitLab host is invalid.', 400);
  }
  if (parsed.host !== host) throw new GitLabApiError('GitLab host is invalid.', 400);
  return host;
}

function normalizeSlug(value: string): string {
  const slug = value.replace(/^\/+|\/+$/g, '');
  const segments = slug.split('/');
  if (!slug || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new GitLabApiError('GitLab repository slug is invalid.', 400);
  }
  return slug;
}
