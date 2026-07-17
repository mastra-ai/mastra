import type { GithubIntegration, GithubTaskDetail } from '../github/integration.js';
import { getFreshLinearAccessToken, LinearReauthRequiredError, loadLinearConnection } from '../linear/connection.js';
import type { LinearIntegration, LinearIssueContext } from '../linear/integration.js';
import type { SourceControlProject } from '../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemSource } from './store.js';

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_TITLE_STATE_LENGTH = 512;
const MAX_DESCRIPTION_LENGTH = 64_000;
const MAX_URL_LENGTH = 2_048;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 100;

export interface FactoryThreadTaskContext {
  task: {
    source: WorkItemSource;
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
    reason?:
      | 'manual'
      | 'not-found'
      | 'not-connected'
      | 'reauth-required'
      | 'provider-unavailable'
      | 'invalid-source';
  };
}

type StoredReason = NonNullable<FactoryThreadTaskContext['resolution']['reason']>;

type ParsedSource =
  | { source: 'github-issue'; identifier: string; number: number }
  | { source: 'github-pr'; identifier: string; number: number }
  | { source: 'linear-issue'; identifier: string };

export interface LoadFactoryThreadTaskContextDeps {
  orgId: string;
  project: SourceControlProject;
  workItem: WorkItemRow;
  githubIntegration?: GithubIntegration;
  ensureGithubReady?: () => Promise<void>;
  linearIntegration?: LinearIntegration;
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

function boundedNames(values: string[]): string[] {
  return values
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS)
    .map(value => value.slice(0, MAX_LIST_ITEM_LENGTH));
}

function storedContext(workItem: WorkItemRow, reason: StoredReason): FactoryThreadTaskContext {
  const url = boundedUrl(workItem.url);
  return {
    task: {
      source: workItem.source,
      title: workItem.title.slice(0, MAX_TITLE_STATE_LENGTH),
      labels: [],
      assignees: [],
      ...(url !== undefined ? { url } : {}),
    },
    resolution: { mode: 'stored', reason },
  };
}

function parseSource(workItem: WorkItemRow): ParsedSource | null {
  const sourceKey = workItem.sourceKey;
  if (!sourceKey) return null;

  if (workItem.source === 'github-issue' || workItem.source === 'github-pr') {
    const prefix = `${workItem.source}:`;
    if (!sourceKey.startsWith(prefix)) return null;
    const identifier = sourceKey.slice(prefix.length);
    if (!/^[1-9]\d{0,9}$/.test(identifier)) return null;
    const number = Number(identifier);
    if (!Number.isSafeInteger(number)) return null;
    return { source: workItem.source, identifier, number };
  }

  if (workItem.source === 'linear-issue') {
    const prefix = 'linear:';
    if (!sourceKey.startsWith(prefix)) return null;
    const identifier = sourceKey.slice(prefix.length);
    if (identifier.length === 0 || identifier.length > MAX_IDENTIFIER_LENGTH) return null;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const humanIdentifier = /^[A-Z][A-Z0-9]{0,31}-[1-9]\d{0,9}$/;
    if (!uuid.test(identifier) && !humanIdentifier.test(identifier)) return null;
    return { source: 'linear-issue', identifier };
  }

  return null;
}

function liveGithubContext(
  workItem: WorkItemRow,
  parsed: Extract<ParsedSource, { source: 'github-issue' | 'github-pr' }>,
  detail: GithubTaskDetail,
): FactoryThreadTaskContext {
  const description = boundedText(detail.description, MAX_DESCRIPTION_LENGTH);
  const state = boundedText(detail.state, MAX_TITLE_STATE_LENGTH);
  const url = boundedUrl(detail.url);
  return {
    task: {
      source: parsed.source,
      identifier: parsed.identifier,
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

function liveLinearContext(
  workItem: WorkItemRow,
  parsed: Extract<ParsedSource, { source: 'linear-issue' }>,
  detail: LinearIssueContext,
): FactoryThreadTaskContext {
  const description = boundedText(detail.description, MAX_DESCRIPTION_LENGTH);
  const state = boundedText(detail.state, MAX_TITLE_STATE_LENGTH);
  const url = boundedUrl(detail.url);
  return {
    task: {
      source: 'linear-issue',
      identifier: parsed.identifier,
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
  if (workItem.source === 'manual') return storedContext(workItem, 'manual');

  const parsed = parseSource(workItem);
  if (!parsed) return storedContext(workItem, 'invalid-source');

  if (parsed.source === 'github-issue' || parsed.source === 'github-pr') {
    const github = deps.githubIntegration;
    if (!github) return storedContext(workItem, 'provider-unavailable');
    const installationId = Number(deps.project.installationExternalId);
    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      return storedContext(workItem, 'provider-unavailable');
    }
    let detail: GithubTaskDetail | null;
    try {
      await deps.ensureGithubReady?.();
      detail =
        parsed.source === 'github-issue'
          ? await github.getIssueDetail(installationId, deps.project.repositorySlug, parsed.number)
          : await github.getPullRequestDetail(installationId, deps.project.repositorySlug, parsed.number);
    } catch {
      return storedContext(workItem, 'provider-unavailable');
    }
    return detail ? liveGithubContext(workItem, parsed, detail) : storedContext(workItem, 'not-found');
  }

  const linear = deps.linearIntegration;
  if (!linear) return storedContext(workItem, 'provider-unavailable');
  const connection = await loadLinearConnection(deps.orgId);
  if (!connection) return storedContext(workItem, 'not-connected');
  let detail: LinearIssueContext | null;
  try {
    await deps.ensureLinearReady?.();
    const accessToken = await getFreshLinearAccessToken(linear, connection);
    detail = await linear.fetchIssueContext(accessToken, parsed.identifier);
  } catch (error) {
    if (error instanceof LinearReauthRequiredError) return storedContext(workItem, 'reauth-required');
    return storedContext(workItem, 'provider-unavailable');
  }
  return detail ? liveLinearContext(workItem, parsed, detail) : storedContext(workItem, 'not-found');
}
