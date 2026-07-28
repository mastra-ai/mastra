import { resolveFactoryGithubRule } from '../../rules/resolve.js';
import type {
  FactoryGithubEventName,
  FactoryGithubRuleContext,
  FactoryRuleActor,
  FactoryRuleDecision,
  FactoryRules,
} from '../../rules/types.js';
import { validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ExternalRepositoryProjectTarget,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import type { GithubRepositoryPermission } from './integration.js';
import type { ParsedGithubWebhook } from './webhook.js';

const TRUSTED_PERMISSIONS = new Set(['write', 'admin']);
const RULE_TIMEOUT_MS = 5_000;

async function withRuleTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('FACTORY_RULE_TIMEOUT')), RULE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function eventName(parsed: ParsedGithubWebhook): FactoryGithubEventName | undefined {
  const action = string(parsed.payload.action);
  if (parsed.event === 'issues' && action === 'opened') return 'issueOpened';
  if (parsed.event === 'pull_request' && action === 'opened') return 'pullRequestOpened';
  if (parsed.event === 'pull_request' && action === 'synchronize') return 'pullRequestUpdated';
  if (parsed.event === 'pull_request' && action === 'closed') {
    return boolean(object(parsed.payload.pull_request)?.merged) ? 'pullRequestMerged' : 'pullRequestClosed';
  }
  if (parsed.event === 'pull_request' && action === 'review_requested') return 'pullRequestReviewRequested';
  return undefined;
}

function canonicalSourceKey(kind: 'issue' | 'pull-request', itemNumber: number): string {
  return kind === 'issue' ? `github-issue:${itemNumber}` : `github-pr:${itemNumber}`;
}

function legacySourceKey(repositoryId: number, kind: 'issue' | 'pull-request', itemNumber: number): string {
  return `github:${repositoryId}:${kind}:${itemNumber}`;
}

function provenanceTarget(repositoryId: number, pullRequestNumber: number): string {
  return `factory-pr-provenance:${repositoryId}:${pullRequestNumber}`;
}

function workItemSource(item: WorkItemRow) {
  if (!item.externalSource) return 'manual' as const;
  return item.externalSource.type === 'pull-request' ? ('github-pr' as const) : ('github-issue' as const);
}

function workItemSourceKey(item: WorkItemRow): string | null {
  return item.externalSource?.externalId ?? null;
}

async function githubActor(
  github: GithubRulesIntegration,
  input: { installationId: number; repository: string; login: string; factoryAuthored: boolean },
): Promise<FactoryRuleActor> {
  let trusted = false;
  try {
    const permission = await github.getRepositoryCollaboratorPermission(
      input.installationId,
      input.repository,
      input.login,
    );
    trusted = permission !== undefined && TRUSTED_PERMISSIONS.has(permission);
  } catch {
    trusted = false;
  }
  return { type: 'github', login: input.login, trusted, factoryAuthored: input.factoryAuthored };
}

interface FactoryPullRequestProvenanceData {
  kind: 'factory-pr-provenance';
  workItemId: string;
}

function pullRequestProvenance(data: Record<string, unknown> | undefined): FactoryPullRequestProvenanceData | null {
  if (!data || data.kind !== 'factory-pr-provenance' || typeof data.workItemId !== 'string') return null;
  return { kind: 'factory-pr-provenance', workItemId: data.workItemId };
}

export interface GithubRulesIntegration {
  getRepositoryCollaboratorPermission(
    installationId: number,
    repoFullName: string,
    username: string,
  ): Promise<GithubRepositoryPermission | undefined>;
}

export interface GithubRulesOptions {
  github: GithubRulesIntegration;
  sourceControl: SourceControlStorageHandle;
  /** Integration-scoped storage; provenance rows are validated at read. */
  integrationStorage: IntegrationStorageHandle;
  projects: FactoryProjectsStorage;
  storage: WorkItemsStorage;
  rules: FactoryRules;
}

export class GithubRules {
  constructor(private readonly options: GithubRulesOptions) {}

  async ingest(parsed: ParsedGithubWebhook): Promise<{ status: 'ignored' | 'committed' | 'replayed' | 'missing' }> {
    const event = eventName(parsed);
    const repository = object(parsed.payload.repository);
    const installationId = number(object(parsed.payload.installation)?.id);
    const repositoryId = number(repository?.id);
    const repositoryName = string(repository?.full_name);
    const login = string(object(parsed.payload.sender)?.login);
    if (!event || !installationId || !repositoryId || !repositoryName || !login) return { status: 'ignored' };

    const projects = await this.options.sourceControl.projectRepositories.listByExternalRepository({
      installationExternalId: String(installationId),
      repositoryExternalId: String(repositoryId),
    });
    if (projects.length === 0) return { status: 'ignored' };
    const results = [];
    for (const project of projects) {
      results.push(
        await this.#ingestProject(parsed, event, installationId, repositoryId, repositoryName, login, project),
      );
    }
    if (results.some(result => result.status === 'committed')) return { status: 'committed' };
    if (results.some(result => result.status === 'replayed')) return { status: 'replayed' };
    return results[0] ?? { status: 'ignored' };
  }

  async #ingestProject(
    parsed: ParsedGithubWebhook,
    event: FactoryGithubEventName,
    installationId: number,
    repositoryId: number,
    repositoryName: string,
    login: string,
    project: ExternalRepositoryProjectTarget,
  ): Promise<{ status: 'committed' | 'replayed' | 'missing' }> {
    const factoryProject = await this.options.projects.get({
      orgId: project.orgId,
      id: project.factoryProjectId,
    });
    if (!factoryProject) return { status: 'missing' };
    const issue = object(parsed.payload.issue);
    const pullRequest = object(parsed.payload.pull_request);
    const issueNumber = number(issue?.number);
    const pullRequestNumber = number(pullRequest?.number);
    const provenance = pullRequestNumber
      ? pullRequestProvenance(
          (
            await this.options.integrationStorage.subscriptions.listByTarget(
              provenanceTarget(repositoryId, pullRequestNumber),
              { status: 'active' },
            )
          ).find(subscription => subscription.orgId === project.orgId)?.data,
        )
      : null;
    const relatedItem = await this.#relatedItem(
      project.orgId,
      project.factoryProjectId,
      repositoryId,
      issueNumber,
      pullRequestNumber,
      string(object(pullRequest?.head)?.ref),
      provenance,
    );
    const actor = await githubActor(this.options.github, {
      installationId,
      repository: repositoryName,
      login,
      factoryAuthored: provenance !== null,
    });
    const context: FactoryGithubRuleContext = {
      tenant: { orgId: project.orgId, projectId: project.factoryProjectId },
      actor,
      ingress: { type: 'github', id: `${installationId}:${parsed.deliveryId}` },
      cause: `github.${event}`,
      causalChain: [],
      ruleSetVersion: this.options.rules.version,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: workItemSource(relatedItem),
              sourceKey: workItemSourceKey(relatedItem),
              parentWorkItemId: relatedItem.parentWorkItemId,
              title: relatedItem.title,
              url: relatedItem.externalSource?.url ?? null,
              stages: relatedItem.stages,
            },
            board: relatedItem.externalSource?.type === 'pull-request' ? ('review' as const) : ('work' as const),
            itemRevision: relatedItem.revision,
          }
        : {}),
      event,
      deliveryId: parsed.deliveryId,
      factory: { createdAt: factoryProject.createdAt.toISOString() },
      repository: { id: repositoryId, fullName: repositoryName },
      ...(issueNumber && string(issue?.title) && string(issue?.html_url)
        ? {
            issue: {
              number: issueNumber,
              title: string(issue?.title)!,
              url: string(issue?.html_url)!,
              ...(string(issue?.created_at) ? { createdAt: string(issue?.created_at) } : {}),
            },
          }
        : {}),
      ...(pullRequestNumber && string(pullRequest?.title) && string(pullRequest?.html_url)
        ? {
            pullRequest: {
              number: pullRequestNumber,
              title: string(pullRequest?.title)!,
              url: string(pullRequest?.html_url)!,
              ...(string(pullRequest?.created_at) ? { createdAt: string(pullRequest?.created_at) } : {}),
              state: string(pullRequest?.state) === 'closed' ? ('closed' as const) : ('open' as const),
              merged: boolean(pullRequest?.merged) ?? false,
              headBranch: string(object(pullRequest?.head)?.ref) ?? '',
              baseBranch: string(object(pullRequest?.base)?.ref) ?? '',
            },
          }
        : {}),
      ...(object(parsed.payload.review)
        ? {
            review: {
              id: number(object(parsed.payload.review)?.id) ?? 0,
              state: string(object(parsed.payload.review)?.state) ?? 'unknown',
              url: string(object(parsed.payload.review)?.html_url) ?? '',
            },
          }
        : {}),
    };

    const rule = resolveFactoryGithubRule(this.options.rules, event);
    let decision: FactoryRuleDecision | void;
    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = rule ? await withRuleTimeout(Promise.resolve(rule(Object.freeze(context)))) : undefined;
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]).map(entry => ({ ...entry }));
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'FACTORY_RULE_TIMEOUT';
      outcome = {
        status: 'rejected',
        code: timedOut ? 'timeout' : 'rule_error',
        reason: timedOut
          ? 'Factory rule evaluation timed out.'
          : error instanceof Error
            ? error.message.slice(0, 2_000)
            : 'Factory GitHub rule failed.',
      };
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: project.orgId,
      factoryProjectId: project.factoryProjectId,
      workItemId: relatedItem?.id ?? null,
      ingress: { identity: `${installationId}:${parsed.deliveryId}`, triggerType: `github.${event}` },
      ruleSetVersion: this.options.rules.version,
      expectedRevision: relatedItem?.revision ?? null,
      actor: { ...actor },
      outcome,
      decisions,
      causalChain: [],
      now: new Date(),
    });
    return { status: committed.status };
  }

  async #relatedItem(
    orgId: string,
    projectId: string,
    repositoryId: number,
    issueNumber: number | undefined,
    pullRequestNumber: number | undefined,
    pullRequestHeadBranch: string | undefined,
    provenance: FactoryPullRequestProvenanceData | null,
  ): Promise<WorkItemRow | undefined> {
    const items = await this.options.storage.list({ orgId, factoryProjectId: projectId });
    if (provenance) return items.find(item => item.id === provenance.workItemId);
    if (issueNumber) {
      return (
        items.find(item => item.externalSource?.externalId === canonicalSourceKey('issue', issueNumber)) ??
        items.find(item => item.externalSource?.externalId === legacySourceKey(repositoryId, 'issue', issueNumber))
      );
    }
    if (pullRequestNumber) {
      return (
        items.find(item => item.externalSource?.externalId === canonicalSourceKey('pull-request', pullRequestNumber)) ??
        items.find(
          item => item.externalSource?.externalId === legacySourceKey(repositoryId, 'pull-request', pullRequestNumber),
        ) ??
        // Provenance fallback: a PR pushed from a work item's session branch
        // belongs to that item even when no gh-pr-create provenance was
        // recorded (session predating state seeding, or the PR was opened
        // outside the tracked tool call). Session branches are per-item
        // (`factory/issue-N`), so a head-branch match is unambiguous.
        (pullRequestHeadBranch
          ? items.find(
              item =>
                item.externalSource?.type !== 'pull-request' &&
                Object.values(item.sessions).some(session => session.branch === pullRequestHeadBranch),
            )
          : undefined)
      );
    }
    return undefined;
  }
}

export interface ReconcilePullRequestState {
  title: string;
  url: string;
  state: 'open' | 'closed';
  merged: boolean;
  headBranch: string;
  baseBranch: string;
  createdAt?: string;
  mergedBy?: string;
}

export type GithubPullRequestFetcher = (input: {
  installationId: number;
  repository: string;
  number: number;
}) => Promise<ReconcilePullRequestState | undefined>;

export interface ReconcileRepository {
  id: number;
  fullName: string;
  installationId: number;
}

export interface ReconcileSweepSummary {
  /** Factory-configured repositories included in the sweep. */
  repositories: number;
  /** PRs whose live state was fetched from GitHub. */
  checked: number;
  /** Missed merges replayed through the rules ingress. */
  merged: number;
  /** Missed closes-without-merge replayed through the rules ingress. */
  closed: number;
  /** PRs (or whole repositories) skipped because of an error. */
  failed: number;
  /** Error samples with context, capped at {@link RECONCILE_ERROR_SAMPLE_LIMIT}. */
  errors: Array<{ repository: string; pullRequestNumber?: number; error: string }>;
}

export type GithubPullRequestReconciler = (repositories: ReconcileRepository[]) => Promise<ReconcileSweepSummary>;

const RECONCILE_ERROR_SAMPLE_LIMIT = 5;

/**
 * Extracts the PR number a work item tracks, but only when the item belongs
 * to the given repository. Card URLs pin the repository unambiguously; the
 * legacy source key embeds the repository id. Canonical keys (`github-pr:N`)
 * carry no repository, so they are only trusted when the item has no URL —
 * a project mapped to multiple repositories must not reconcile one repo's
 * card against another repo's PR number.
 */
function reconcilablePullRequestNumber(item: WorkItemRow, repository: ReconcileRepository): number | undefined {
  if (item.externalSource?.type !== 'pull-request') return undefined;
  const url = item.externalSource.url;
  if (url) {
    const match = /^https?:\/\/[^/]+\/(.+)\/pull\/(\d+)(?:[/?#]|$)/.exec(url);
    if (!match) return undefined;
    return match[1] === repository.fullName ? Number(match[2]) : undefined;
  }
  const externalId = item.externalSource.externalId;
  const legacy = /^github:(\d+):pull-request:(\d+)$/.exec(externalId);
  if (legacy) return Number(legacy[1]) === repository.id ? Number(legacy[2]) : undefined;
  const canonical = /^github-pr:(\d+)$/.exec(externalId);
  return canonical ? Number(canonical[1]) : undefined;
}

export function reconciledClosedEvent(
  repository: ReconcileRepository,
  pullRequestNumber: number,
  state: ReconcilePullRequestState,
): ParsedGithubWebhook {
  return {
    event: 'pull_request',
    // Stable per (repository, PR, outcome): the ingress dedupe makes repeat
    // reconcile cycles replay instead of re-committing decisions.
    deliveryId: `reconcile:${repository.id}:pull-request:${pullRequestNumber}:${state.merged ? 'merged' : 'closed'}`,
    payload: {
      action: 'closed',
      installation: { id: repository.installationId },
      repository: { id: repository.id, full_name: repository.fullName },
      sender: { login: state.mergedBy ?? 'github' },
      pull_request: {
        number: pullRequestNumber,
        title: state.title,
        html_url: state.url,
        ...(state.createdAt ? { created_at: state.createdAt } : {}),
        state: 'closed',
        merged: state.merged,
        head: { ref: state.headBranch },
        base: { ref: state.baseBranch },
      },
    },
  };
}

/**
 * State-based safety net for merge signals: webhooks and event-log tailing
 * can miss a merge (cursor gaps, downtime, terminally failed decisions), so
 * this sweep compares still-open PR cards against actual GitHub state and
 * replays the merge through the normal rules ingress when they disagree.
 */
export function createGithubPullRequestReconciler(
  options: GithubRulesOptions,
  fetchPullRequest: GithubPullRequestFetcher,
): GithubPullRequestReconciler {
  const rules = new GithubRules(options);
  return async repositories => {
    const summary: ReconcileSweepSummary = { repositories: 0, checked: 0, merged: 0, closed: 0, failed: 0, errors: [] };
    const recordFailure = (repository: ReconcileRepository, error: unknown, pullRequestNumber?: number) => {
      summary.failed += 1;
      if (summary.errors.length < RECONCILE_ERROR_SAMPLE_LIMIT) {
        summary.errors.push({
          repository: repository.fullName,
          ...(pullRequestNumber === undefined ? {} : { pullRequestNumber }),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    // An installation can expose hundreds of repositories; only the ones
    // actually linked to a factory project can have cards to reconcile, so
    // scope the sweep to those up front instead of probing each repository.
    const configured = new Set(
      (await options.sourceControl.projectRepositories.listConfiguredExternalKeys()).map(
        key => `${key.installationExternalId}\u0000${key.repositoryExternalId}`,
      ),
    );
    const scoped = repositories.filter(repository =>
      configured.has(`${repository.installationId}\u0000${repository.id}`),
    );
    summary.repositories = scoped.length;
    for (const repository of scoped) {
      // One broken repository (or a failing token exchange for its
      // installation) must not abort the sweep for the others.
      let numbers: Set<number>;
      try {
        const projects = await options.sourceControl.projectRepositories.listByExternalRepository({
          installationExternalId: String(repository.installationId),
          repositoryExternalId: String(repository.id),
        });
        if (projects.length === 0) continue;
        numbers = new Set<number>();
        for (const project of projects) {
          const items = await options.storage.list({
            orgId: project.orgId,
            factoryProjectId: project.factoryProjectId,
          });
          for (const item of items) {
            const stage = item.stages[0];
            if (stage === 'done' || stage === 'canceled') continue;
            const pullRequestNumber = reconcilablePullRequestNumber(item, repository);
            if (pullRequestNumber) numbers.add(pullRequestNumber);
          }
        }
      } catch (error) {
        recordFailure(repository, error);
        continue;
      }
      for (const pullRequestNumber of numbers) {
        try {
          const state = await fetchPullRequest({
            installationId: repository.installationId,
            repository: repository.fullName,
            number: pullRequestNumber,
          });
          summary.checked += 1;
          if (!state || state.state !== 'closed') continue;
          await rules.ingest(reconciledClosedEvent(repository, pullRequestNumber, state));
          if (state.merged) summary.merged += 1;
          else summary.closed += 1;
        } catch (error) {
          recordFailure(repository, error, pullRequestNumber);
        }
      }
    }
    return summary;
  };
}

function githubRulesOptions(github: GithubRulesIntegration, context: IntegrationContext): GithubRulesOptions | undefined {
  if (!context.rules) return undefined;
  return {
    github,
    sourceControl: context.storage.sourceControl,
    integrationStorage: context.storage.generic,
    projects: context.storage.projects,
    storage: context.rules.workItems,
    rules: context.rules.config,
  };
}

export function attachGithubRules(
  github: GithubRulesIntegration,
  context: IntegrationContext,
): ((event: ParsedGithubWebhook) => Promise<unknown>) | undefined {
  const options = githubRulesOptions(github, context);
  if (!options) return undefined;
  const rules = new GithubRules(options);
  return event => rules.ingest(event);
}

export function attachGithubReconciler(
  github: GithubRulesIntegration,
  context: IntegrationContext,
  fetchPullRequest: GithubPullRequestFetcher,
): GithubPullRequestReconciler | undefined {
  const options = githubRulesOptions(github, context);
  if (!options) return undefined;
  return createGithubPullRequestReconciler(options, fetchPullRequest);
}
