import type { GithubIntegration } from '../integrations/github/integration.js';
import type { ParsedGithubWebhook } from '../integrations/github/webhook.js';
import type { IntegrationStorageHandle } from '../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type {
  ExternalRepositoryProjectTarget,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { resolveFactoryGithubRule } from './resolve.js';
import type {
  FactoryGithubEventName,
  FactoryGithubRuleContext,
  FactoryRuleActor,
  FactoryRuleDecision,
  FactoryRules,
} from './types.js';
import { validateFactoryRuleDecisions } from './validation.js';

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
  if (parsed.event === 'pull_request' && action === 'closed' && boolean(object(parsed.payload.pull_request)?.merged)) {
    return 'pullRequestMerged';
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
  github: GithubIntegration,
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

export interface FactoryGithubEventServiceOptions {
  github: GithubIntegration;
  sourceControl: SourceControlStorageHandle;
  integrationStorage: IntegrationStorageHandle<
    Record<string, unknown>,
    Record<string, unknown>,
    FactoryPullRequestProvenanceData
  >;
  projects: FactoryProjectsStorage;
  storage: WorkItemsStorage;
  rules: FactoryRules;
}

export class FactoryGithubEventService {
  constructor(private readonly options: FactoryGithubEventServiceOptions) {}

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
      ? ((
          await this.options.integrationStorage.subscriptions.listByTarget(
            provenanceTarget(repositoryId, pullRequestNumber),
            { status: 'active' },
          )
        ).find(subscription => subscription.orgId === project.orgId)?.data ?? null)
      : null;
    const relatedItem = await this.#relatedItem(
      project.orgId,
      project.factoryProjectId,
      repositoryId,
      issueNumber,
      pullRequestNumber,
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
        )
      );
    }
    return undefined;
  }
}
