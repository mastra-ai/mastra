import type { IntegrationConnection } from './capabilities/connection.js';
import { isTaskContextProviderRequestError } from './capabilities/task-context.js';
import type { TaskContextDetail } from './capabilities/task-context.js';
import type { FactoryIntegration } from './integrations/base.js';
import { LinearProviderUnavailableError, LinearReauthRequiredError } from './integrations/linear/integration.js';
import type { LinearIntegration } from './integrations/linear/integration.js';
import type {
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlStorageHandle,
} from './storage/domains/source-control/base.js';
import type { ExternalWorkItemSource, WorkItemRow } from './storage/domains/work-items/base.js';

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_TITLE_STATE_LENGTH = 512;
const MAX_DESCRIPTION_LENGTH = 64_000;
const MAX_URL_LENGTH = 2_048;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 100;
const MAX_SOURCE_NUMBER = 9_999_999_999;
const LINEAR_ISSUE_IDENTIFIER_RE = /^[A-Z][A-Z0-9]*-[1-9]\d*$/;
const LINEAR_ISSUE_UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type FactoryTaskSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'manual';

export interface FactoryThreadTaskContext {
  task: {
    source: FactoryTaskSource;
    identifier?: string;
    title: string;
    description?: string;
    state?: string;
    labels: string[];
    assignees: string[];
    url?: string;
  };
  resolution: {
    mode: 'live' | 'stored';
    reason?: 'manual' | 'not-found' | 'not-connected' | 'reauth-required' | 'provider-unavailable' | 'invalid-source';
  };
}

type StoredReason = NonNullable<FactoryThreadTaskContext['resolution']['reason']>;
export type LinearTaskContextIntegration = FactoryIntegration &
  Partial<Pick<LinearIntegration, 'loadConnection' | 'getFreshAccessToken'>> & {
    getTaskContextConnection?: (orgId: string) => Promise<IntegrationConnection | null>;
  };

type ParsedSource =
  | { source: 'github-issue'; identifier: string; number: number; repositoryExternalId: string }
  | { source: 'github-pr'; identifier: string; number: number; repositoryExternalId: string }
  | { source: 'linear-issue'; identifier: string; issueId: string; sourceId?: string };

export interface LoadFactoryThreadTaskContextDeps {
  orgId: string;
  factoryProjectId: string;
  workItem: WorkItemRow;
  sourceControlStorage?: SourceControlStorageHandle;
  githubIntegration?: FactoryIntegration;
  ensureGithubReady?: () => Promise<void>;
  linearIntegration?: LinearTaskContextIntegration;
  ensureLinearReady?: () => Promise<void>;
}

function boundedText(value: string | null | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.slice(0, maxLength);
}

function boundedUrl(value: string | null | undefined): string | undefined {
  if (!value || value.length > MAX_URL_LENGTH) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

function boundedNames(values: Array<string | null | undefined>): string[] {
  return values
    .filter((value): value is string => Boolean(value))
    .slice(0, MAX_LIST_ITEMS)
    .map(value => value.slice(0, MAX_LIST_ITEM_LENGTH));
}

function sourceType(source: ExternalWorkItemSource | null): FactoryTaskSource {
  if (!source) return 'manual';
  if (source.integrationId === 'github' && source.type === 'issue') return 'github-issue';
  if (source.integrationId === 'github' && source.type === 'pull-request') return 'github-pr';
  if (source.integrationId === 'linear' && source.type === 'issue') return 'linear-issue';
  return 'manual';
}

function storedContext(workItem: WorkItemRow, reason: StoredReason): FactoryThreadTaskContext {
  const source = sourceType(workItem.externalSource);
  const url = boundedUrl(workItem.externalSource?.url);
  return {
    task: {
      source,
      title: workItem.title.slice(0, MAX_TITLE_STATE_LENGTH),
      labels: [],
      assignees: [],
      ...(url !== undefined ? { url } : {}),
    },
    resolution: { mode: 'stored', reason },
  };
}

function barePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 && value <= MAX_SOURCE_NUMBER ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function sourcePositiveInteger(value: string, prefix: 'github-issue' | 'github-pr'): number | null {
  const bare = barePositiveInteger(value);
  if (bare !== null) return bare;
  const match = value.match(new RegExp(`^${prefix}:([1-9]\\d{0,9})$`));
  return match ? barePositiveInteger(match[1]) : null;
}

function metadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return null;
}

function validLinearIssueIdentifier(value: string): boolean {
  if (value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) return false;
  return LINEAR_ISSUE_IDENTIFIER_RE.test(value) || LINEAR_ISSUE_UUID_RE.test(value);
}

function parseSource(workItem: WorkItemRow): ParsedSource | null {
  const source = workItem.externalSource;
  if (!source) return null;

  if (source.integrationId === 'github' && (source.type === 'issue' || source.type === 'pull-request')) {
    const numberKey = source.type === 'issue' ? 'githubIssueNumber' : 'githubPullRequestNumber';
    const parsedSource = source.type === 'issue' ? 'github-issue' : 'github-pr';
    const metadataNumber = workItem.metadata?.[numberKey];
    const number =
      metadataNumber === undefined
        ? sourcePositiveInteger(source.externalId, parsedSource)
        : barePositiveInteger(metadataNumber);
    const repositoryExternalId = metadataString(workItem.metadata, 'githubRepositoryId');
    if (number === null || !repositoryExternalId) return null;
    return { source: parsedSource, identifier: String(number), number, repositoryExternalId };
  }

  if (source.integrationId === 'linear' && source.type === 'issue') {
    const metadataIdentifier = workItem.metadata?.linearIssueIdentifier;
    const externalIdentifier = source.externalId.startsWith('linear:')
      ? source.externalId.slice('linear:'.length)
      : source.externalId;
    const identifier = metadataIdentifier === undefined ? externalIdentifier : metadataIdentifier;
    if (typeof identifier !== 'string' || !validLinearIssueIdentifier(identifier)) return null;
    const metadataIssueId = metadataString(workItem.metadata, 'linearIssueId');
    const issueId = metadataIssueId && validLinearIssueIdentifier(metadataIssueId) ? metadataIssueId : identifier;
    const metadataSourceId = metadataString(workItem.metadata, 'linearIssueSourceId');
    const sourceId = source.sourceId ?? metadataSourceId ?? undefined;
    if (sourceId && sourceId.length > 512) return null;
    return { source: 'linear-issue', identifier, issueId, ...(sourceId ? { sourceId } : {}) };
  }

  return null;
}

async function resolveGithubRepository(
  storage: SourceControlStorageHandle,
  orgId: string,
  factoryProjectId: string,
  repositoryExternalId: string,
): Promise<{ installation: SourceControlInstallation; repository: SourceControlRepository } | null> {
  const connections = await storage.connections.list({ orgId, factoryProjectId });
  for (const connection of connections) {
    const projectRepositories = await storage.projectRepositories.list({ orgId, connectionId: connection.id });
    for (const projectRepository of projectRepositories) {
      const repository = await storage.repositories.get({ orgId, id: projectRepository.repositoryId });
      if (!repository || repository.externalId !== repositoryExternalId) continue;
      const installation = await storage.installations.get({ orgId, id: connection.installationId });
      if (installation) return { installation, repository };
    }
  }
  return null;
}

function liveIssueContext(
  workItem: WorkItemRow,
  parsed: Extract<ParsedSource, { source: 'github-issue' | 'linear-issue' }>,
  detail: TaskContextDetail,
): FactoryThreadTaskContext {
  const description = boundedText(detail.description, MAX_DESCRIPTION_LENGTH);
  const state = boundedText(detail.state, MAX_TITLE_STATE_LENGTH);
  const url = boundedUrl(detail.url);
  return {
    task: {
      source: parsed.source,
      identifier: boundedText(detail.identifier, MAX_IDENTIFIER_LENGTH) ?? parsed.identifier,
      title: boundedText(detail.title, MAX_TITLE_STATE_LENGTH) ?? workItem.title.slice(0, MAX_TITLE_STATE_LENGTH),
      ...(description !== undefined ? { description } : {}),
      ...(state !== undefined ? { state } : {}),
      labels: boundedNames(detail.labels),
      assignees: boundedNames(detail.assignees),
      ...(url !== undefined ? { url } : {}),
    },
    resolution: { mode: 'live' },
  };
}

function livePullRequestContext(
  workItem: WorkItemRow,
  parsed: Extract<ParsedSource, { source: 'github-pr' }>,
  detail: TaskContextDetail,
): FactoryThreadTaskContext {
  const description = boundedText(detail.description, MAX_DESCRIPTION_LENGTH);
  const state = boundedText(detail.state, MAX_TITLE_STATE_LENGTH);
  const url = boundedUrl(detail.url);
  return {
    task: {
      source: 'github-pr',
      identifier: boundedText(detail.identifier, MAX_IDENTIFIER_LENGTH) ?? parsed.identifier,
      title: boundedText(detail.title, MAX_TITLE_STATE_LENGTH) ?? workItem.title.slice(0, MAX_TITLE_STATE_LENGTH),
      ...(description !== undefined ? { description } : {}),
      ...(state !== undefined ? { state } : {}),
      labels: boundedNames(detail.labels),
      assignees: boundedNames(detail.assignees),
      ...(url !== undefined ? { url } : {}),
    },
    resolution: { mode: 'live' },
  };
}

export async function loadFactoryThreadTaskContext(
  deps: LoadFactoryThreadTaskContextDeps,
): Promise<FactoryThreadTaskContext> {
  const { workItem } = deps;
  if (!workItem.externalSource) return storedContext(workItem, 'manual');

  const parsed = parseSource(workItem);
  if (!parsed) return storedContext(workItem, 'invalid-source');

  if (parsed.source === 'github-issue' || parsed.source === 'github-pr') {
    const github = deps.githubIntegration;
    if (!github || !deps.sourceControlStorage) return storedContext(workItem, 'provider-unavailable');
    await deps.ensureGithubReady?.();
    const resolvedRepository = await resolveGithubRepository(
      deps.sourceControlStorage,
      deps.orgId,
      deps.factoryProjectId,
      parsed.repositoryExternalId,
    );
    if (!resolvedRepository) return storedContext(workItem, 'not-found');
    const installationId = Number(resolvedRepository.installation.externalId);
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      return storedContext(workItem, 'provider-unavailable');
    }
    const connection = { type: 'app-installation' as const, installationId };
    if (parsed.source === 'github-issue') {
      if (!github.taskContext?.getIssue) return storedContext(workItem, 'provider-unavailable');
      let detail: TaskContextDetail | null;
      try {
        detail = await github.taskContext.getIssue({
          connection,
          sourceId: resolvedRepository.repository.slug,
          issueId: String(parsed.number),
        });
      } catch (error) {
        if (isTaskContextProviderRequestError(error)) return storedContext(workItem, 'provider-unavailable');
        throw error;
      }
      return detail ? liveIssueContext(workItem, parsed, detail) : storedContext(workItem, 'not-found');
    }
    if (!github.taskContext?.getPullRequest) return storedContext(workItem, 'provider-unavailable');
    let detail: TaskContextDetail | null;
    try {
      detail = await github.taskContext.getPullRequest({
        connection,
        sourceId: resolvedRepository.repository.slug,
        pullRequestId: String(parsed.number),
      });
    } catch (error) {
      if (isTaskContextProviderRequestError(error)) return storedContext(workItem, 'provider-unavailable');
      throw error;
    }
    return detail ? livePullRequestContext(workItem, parsed, detail) : storedContext(workItem, 'not-found');
  }

  const linear = deps.linearIntegration;
  if (!linear?.taskContext?.getIssue) return storedContext(workItem, 'provider-unavailable');
  if (linear.getTaskContextConnection && !parsed.sourceId) {
    return storedContext(workItem, 'provider-unavailable');
  }
  await deps.ensureLinearReady?.();

  let taskContextConnection: IntegrationConnection | null;
  try {
    if (linear.getTaskContextConnection) {
      taskContextConnection = await linear.getTaskContextConnection(deps.orgId);
    } else {
      if (!linear.loadConnection || !linear.getFreshAccessToken) {
        return storedContext(workItem, 'provider-unavailable');
      }
      const connection = await linear.loadConnection(deps.orgId);
      if (!connection) return storedContext(workItem, 'not-connected');
      const accessToken = await linear.getFreshAccessToken(connection);
      taskContextConnection = { type: 'oauth', accessToken };
    }
  } catch (error) {
    if (error instanceof LinearReauthRequiredError) return storedContext(workItem, 'reauth-required');
    if (error instanceof LinearProviderUnavailableError || isTaskContextProviderRequestError(error)) {
      return storedContext(workItem, 'provider-unavailable');
    }
    throw error;
  }
  if (!taskContextConnection) return storedContext(workItem, 'not-connected');

  let detail: TaskContextDetail | null;
  try {
    detail = await linear.taskContext.getIssue({
      connection: taskContextConnection,
      ...(parsed.sourceId ? { sourceId: parsed.sourceId } : {}),
      issueId: parsed.issueId,
    });
  } catch (error) {
    if (isTaskContextProviderRequestError(error)) return storedContext(workItem, 'provider-unavailable');
    throw error;
  }
  return detail ? liveIssueContext(workItem, parsed, detail) : storedContext(workItem, 'not-found');
}
