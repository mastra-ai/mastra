import { boardForWorkItem } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import type {
  FactoryGitLabEventName,
  FactoryGitLabRuleContext,
  FactoryRuleActor,
  FactoryRuleDecision,
} from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ExternalRepositoryProjectTarget,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import type { GitLabEventRules } from './default-rules.js';
import { encodeIssueReference, encodeSourceId, GITLAB_TRUSTED_ACCESS_LEVEL } from './integration.js';
import type { ParsedGitLabWebhook } from './webhook.js';

const RULE_TIMEOUT_MS = 5_000;

type IngressStatus = 'ignored' | 'committed' | 'replayed' | 'missing';

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

function usernames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    const username = string(object(entry)?.username);
    return username ? [username] : [];
  });
}

function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (typeof entry === 'string') return entry ? [entry] : [];
    const title = string(object(entry)?.title) ?? string(object(entry)?.name);
    return title ? [title] : [];
  });
}

function labelColors(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(
    value.flatMap(entry => {
      const label = object(entry);
      const name = string(label?.title) ?? string(label?.name);
      const color = string(label?.color);
      return name && color ? [[name, color]] : [];
    }),
  );
}

function eventName(parsed: ParsedGitLabWebhook): FactoryGitLabEventName | undefined {
  const attributes = object(parsed.payload.object_attributes);
  const action = string(attributes?.action)?.toLowerCase();
  if (parsed.event === 'Issue Hook') {
    if (action === 'open' || action === 'reopen') return 'issueOpened';
    if (action === 'close') return 'issueClosed';
    return 'issueUpdated';
  }
  if (parsed.event === 'Note Hook') {
    const noteableType = string(attributes?.noteable_type);
    if (noteableType === 'Issue') return 'issueCommented';
    if (noteableType === 'MergeRequest') return 'mergeRequestCommented';
    return;
  }
  if (parsed.event !== 'Merge Request Hook') return;
  if (action === 'open' || action === 'reopen') return 'mergeRequestOpened';
  if (action === 'merge') return 'mergeRequestMerged';
  if (action === 'close') return 'mergeRequestClosed';
  return 'mergeRequestUpdated';
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function hostFromPayload(parsed: ParsedGitLabWebhook): string | undefined {
  const declaredHost = parsed.instanceHost ? normalizeHost(parsed.instanceHost) : undefined;
  const projectUrl = string(object(parsed.payload.project)?.web_url);
  if (!projectUrl) return declaredHost;
  try {
    const payloadHost = normalizeHost(new URL(projectUrl).host);
    if (declaredHost && declaredHost !== payloadHost) return undefined;
    return payloadHost;
  } catch {
    return undefined;
  }
}

function mergeRequestSourceKey(host: string, projectId: number, mergeRequestIid: number): string {
  return `gitlab-pr:${Buffer.from(JSON.stringify({ version: 1, host, projectId, mergeRequestIid }), 'utf8').toString('base64url')}`;
}

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

export interface GitLabRulesIntegration {
  readonly rules: GitLabEventRules;
  getProjectMemberAccessLevel(connectionId: string, projectId: string, username: string): Promise<number | undefined>;
  getWorkItemAuthorUsername(
    connectionId: string,
    projectId: string,
    kind: 'issue' | 'merge_request',
    iid: number,
  ): Promise<string | undefined>;
}

interface GitLabRulesOptions {
  gitlab: GitLabRulesIntegration;
  sourceControl: SourceControlStorageHandle;
  projects: FactoryProjectsStorage;
  storage: WorkItemsStorage;
  intake: IntakeStorage;
  configVersion: string;
  boards: BoardRegistry;
}

interface ProjectTarget {
  target: ExternalRepositoryProjectTarget;
  connectionIds: string[];
}

export class GitLabRules {
  constructor(private readonly options: GitLabRulesOptions) {}

  async ingest(parsed: ParsedGitLabWebhook): Promise<{ status: IngressStatus }> {
    const event = eventName(parsed);
    const project = object(parsed.payload.project);
    const projectId = number(project?.id);
    const projectPath = string(project?.path_with_namespace);
    const host = hostFromPayload(parsed);
    const username = string(parsed.payload.user_username) ?? string(object(parsed.payload.user)?.username);
    if (!event || !projectId || !projectPath || !host || !username) return { status: 'ignored' };

    const targets = await this.#targets(String(projectId), host);
    if (targets.length === 0) return { status: 'ignored' };
    const results: Array<{ status: IngressStatus }> = [];
    for (const target of targets) {
      results.push(await this.#ingestProject(parsed, event, projectId, projectPath, host, username, target));
    }
    if (results.some(result => result.status === 'committed')) return { status: 'committed' };
    if (results.some(result => result.status === 'replayed')) return { status: 'replayed' };
    return results[0] ?? { status: 'ignored' };
  }

  async #targets(repositoryExternalId: string, host: string): Promise<ProjectTarget[]> {
    const grouped = new Map<string, ProjectTarget>();
    const keys = (await this.options.sourceControl.projectRepositories.listConfiguredExternalKeys()).filter(
      key => key.repositoryExternalId === repositoryExternalId,
    );
    for (const key of keys) {
      const targets = await this.options.sourceControl.projectRepositories.listByExternalRepository({
        installationExternalId: key.installationExternalId,
        repositoryExternalId,
      });
      for (const target of targets) {
        const installation = await this.options.sourceControl.installations.findByExternalId({
          orgId: target.orgId,
          externalId: key.installationExternalId,
        });
        const installationHost = string(installation?.providerMetadata.host);
        if (!installationHost || normalizeHost(installationHost) !== normalizeHost(host)) continue;
        const id = `${target.orgId}:${target.factoryProjectId}`;
        const current = grouped.get(id);
        if (current) {
          if (!current.connectionIds.includes(key.installationExternalId)) {
            current.connectionIds.push(key.installationExternalId);
          }
        } else {
          grouped.set(id, { target, connectionIds: [key.installationExternalId] });
        }
      }
    }
    return [...grouped.values()];
  }

  async #ingestProject(
    parsed: ParsedGitLabWebhook,
    event: FactoryGitLabEventName,
    projectId: number,
    projectPath: string,
    host: string,
    username: string,
    target: ProjectTarget,
  ): Promise<{ status: IngressStatus }> {
    const factoryProject = await this.options.projects.get({
      orgId: target.target.orgId,
      id: target.target.factoryProjectId,
    });
    if (!factoryProject) return { status: 'missing' };

    const sourceId = encodeSourceId({ host, projectId: String(projectId) });
    const config = await this.options.intake.getConfig({
      orgId: target.target.orgId,
      integrationIds: ['gitlab'],
    });
    if (!config.gitlab?.enabled || !config.gitlab.sourceIds?.includes(sourceId)) return { status: 'ignored' };
    const binding = (await this.options.intake.listBindings({ orgId: target.target.orgId, integrationId: 'gitlab' })).find(
      candidate => candidate.sourceId === sourceId && candidate.factoryProjectId === target.target.factoryProjectId,
    );
    if (!binding) return { status: 'ignored' };
    const board = this.options.boards.get(binding.board ?? 'work');
    if (!board) return { status: 'ignored' };

    const attributes = object(parsed.payload.object_attributes);
    const issue = parsed.event === 'Note Hook' ? object(parsed.payload.issue) : attributes;
    const mergeRequest = parsed.event === 'Note Hook' ? object(parsed.payload.merge_request) : attributes;
    const issueIid = number(issue?.iid);
    const mergeRequestIid = number(mergeRequest?.iid);
    const issueSourceKey = issueIid
      ? encodeIssueReference({ host, projectId: String(projectId), issueIid })
      : undefined;
    const mergeRequestKey = mergeRequestIid ? mergeRequestSourceKey(host, projectId, mergeRequestIid) : undefined;
    const items = await this.options.storage.list({
      orgId: target.target.orgId,
      factoryProjectId: target.target.factoryProjectId,
    });
    const issueItem = issueSourceKey
      ? items.find(item => item.externalSource?.integrationId === 'gitlab' && item.externalSource.externalId === issueSourceKey)
      : undefined;
    const reviewItem = mergeRequestKey
      ? items.find(item => item.externalSource?.integrationId === 'gitlab' && item.externalSource.externalId === mergeRequestKey)
      : undefined;
    const headBranch = string(mergeRequest?.source_branch) ?? '';
    const authoringItem = headBranch
      ? items.find(
          item =>
            item.externalSource?.type !== 'pull-request' &&
            Object.values(item.sessions).some(session => session.branch === headBranch),
        )
      : undefined;
    const actorTrusted = await this.#trusted(target.connectionIds, String(projectId), username);
    const eventUserId = number(object(parsed.payload.user)?.id) ?? number(parsed.payload.user_id);
    const resolveAuthor = async (
      item: Record<string, unknown> | undefined,
      kind: 'issue' | 'merge_request',
      iid: number | undefined,
    ): Promise<string | undefined> => {
      if (!item || !iid) return undefined;
      const embedded = string(object(item.author)?.username);
      if (embedded) return embedded;
      if (eventUserId && eventUserId === number(item.author_id)) return username;
      for (const connectionId of target.connectionIds) {
        try {
          const resolved = await this.options.gitlab.getWorkItemAuthorUsername(
            connectionId,
            String(projectId),
            kind,
            iid,
          );
          if (resolved) return resolved;
        } catch {
          // Another active credential may cover this project; otherwise leave author trust unset.
        }
      }
      return undefined;
    };
    const [issueAuthor, mergeRequestAuthor] = await Promise.all([
      resolveAuthor(issue, 'issue', issueIid),
      resolveAuthor(mergeRequest, 'merge_request', mergeRequestIid),
    ]);
    const authorTrusted = async (author: string | undefined): Promise<boolean> => {
      if (!author) return false;
      return author === username
        ? actorTrusted
        : this.#trusted(target.connectionIds, String(projectId), author);
    };
    const [issueAuthorTrusted, mergeRequestAuthorTrusted] = await Promise.all([
      authorTrusted(issueAuthor),
      authorTrusted(mergeRequestAuthor),
    ]);
    const actor: FactoryRuleActor = {
      type: 'gitlab',
      username,
      trusted: actorTrusted,
      factoryAuthored: false,
    };

    const candidates: Array<WorkItemRow | undefined> =
      event === 'mergeRequestMerged'
        ? [...new Map([reviewItem, authoringItem].filter(Boolean).map(item => [item!.id, item!])).values()]
        : event === 'mergeRequestCommented'
          ? [authoringItem ?? reviewItem]
          : event === 'mergeRequestOpened'
            ? [authoringItem]
            : event.startsWith('mergeRequest')
              ? [reviewItem ?? authoringItem]
              : [issueItem];
    const results = [];
    for (const [index, item] of candidates.entries()) {
      results.push(
        await this.#evaluate({
          parsed,
          event,
          projectId,
          projectPath,
          host,
          actor,
          orgId: target.target.orgId,
          factoryProjectId: target.target.factoryProjectId,
          factoryProject,
          board: { board: board.id, initialPhase: board.initialPhase },
          issue,
          issueAuthor,
          issueAuthorTrusted,
          issueIid,
          issueSourceKey,
          mergeRequest,
          mergeRequestAuthor,
          mergeRequestAuthorTrusted,
          mergeRequestIid,
          mergeRequestKey,
          factoryAuthored: Boolean(authoringItem),
          item,
          ingressIdentity: `gitlab:${projectId}:${parsed.deliveryId}${index ? `:${item?.id ?? index}` : ''}`,
        }),
      );
    }
    if (results.some(result => result.status === 'committed')) return { status: 'committed' };
    if (results.some(result => result.status === 'replayed')) return { status: 'replayed' };
    return results[0] ?? { status: 'ignored' };
  }

  async #trusted(connectionIds: string[], projectId: string, username: string): Promise<boolean> {
    for (const connectionId of connectionIds) {
      try {
        const level = await this.options.gitlab.getProjectMemberAccessLevel(connectionId, projectId, username);
        if (level !== undefined) return level >= GITLAB_TRUSTED_ACCESS_LEVEL;
      } catch {
        // Try another active credential covering the same canonical project; otherwise fail closed.
      }
    }
    return false;
  }

  async #evaluate(input: {
    parsed: ParsedGitLabWebhook;
    event: FactoryGitLabEventName;
    projectId: number;
    projectPath: string;
    host: string;
    actor: FactoryRuleActor;
    orgId: string;
    factoryProjectId: string;
    factoryProject: { createdAt: Date };
    board: { board: string; initialPhase: string };
    issue: Record<string, unknown> | undefined;
    issueAuthor: string | undefined;
    issueAuthorTrusted: boolean;
    issueIid: number | undefined;
    issueSourceKey: string | undefined;
    mergeRequest: Record<string, unknown> | undefined;
    mergeRequestAuthor: string | undefined;
    mergeRequestAuthorTrusted: boolean;
    mergeRequestIid: number | undefined;
    mergeRequestKey: string | undefined;
    factoryAuthored: boolean;
    item: WorkItemRow | undefined;
    ingressIdentity: string;
  }): Promise<{ status: IngressStatus }> {
    const note = object(input.parsed.payload.object_attributes);
    const issueAuthor = input.issueAuthor;
    const mergeRequestAuthor = input.mergeRequestAuthor;
    const mergeRequestState = string(input.mergeRequest?.state);
    const context: FactoryGitLabRuleContext = {
      tenant: { orgId: input.orgId, projectId: input.factoryProjectId },
      actor: input.actor,
      ingress: { type: 'gitlab', id: input.ingressIdentity },
      cause: `gitlab.${input.event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(input.item
        ? {
            item: {
              id: input.item.id,
              source:
                input.item.externalSource?.type === 'pull-request'
                  ? ('gitlab-pr' as const)
                  : input.item.externalSource?.integrationId === 'gitlab'
                    ? ('gitlab-issue' as const)
                    : ('manual' as const),
              sourceKey: input.item.externalSource?.externalId ?? null,
              parentWorkItemId: input.item.parentWorkItemId,
              title: input.item.title,
              url: input.item.externalSource?.url ?? null,
              stages: input.item.stages,
              acceptedAt: input.item.acceptedAt,
              metadata: input.item.metadata,
            },
            board: boardForWorkItem(input.item),
            itemRevision: input.item.revision,
          }
        : {}),
      intake: input.board,
      event: input.event,
      deliveryId: input.parsed.deliveryId,
      factory: { createdAt: input.factoryProject.createdAt.toISOString() },
      repository: { id: input.projectId, fullName: input.projectPath, host: input.host },
      ...(input.issueIid && input.issueSourceKey && string(input.issue?.title)
        ? {
            issue: {
              number: input.issueIid,
              sourceKey: input.issueSourceKey,
              title: string(input.issue?.title)!,
              url:
                string(input.issue?.url) ??
                string(input.issue?.web_url) ??
                `https://${input.host}/${input.projectPath}/-/issues/${input.issueIid}`,
              ...(string(input.issue?.created_at) ? { createdAt: string(input.issue?.created_at) } : {}),
              ...(string(input.issue?.updated_at) ? { updatedAt: string(input.issue?.updated_at) } : {}),
              assignees: usernames(input.parsed.payload.assignees ?? input.issue?.assignees),
              labels: labelNames(input.issue?.labels ?? input.parsed.payload.labels),
              labelColors: labelColors(input.issue?.labels ?? input.parsed.payload.labels),
              state: string(input.issue?.state) === 'closed' ? ('closed' as const) : ('open' as const),
              ...(issueAuthor ? { author: issueAuthor } : {}),
              authorTrusted: input.issueAuthorTrusted,
            },
          }
        : {}),
      ...(input.parsed.event === 'Note Hook' && number(note?.id)
        ? {
            note: {
              id: number(note?.id)!,
              ...(string(note?.note) ? { body: string(note?.note) } : {}),
              ...(string(note?.url) ? { url: string(note?.url) } : {}),
              ...(string(object(input.parsed.payload.user)?.username)
                ? { author: string(object(input.parsed.payload.user)?.username) }
                : {}),
              ...(string(note?.created_at) ? { createdAt: string(note?.created_at) } : {}),
              ...(string(note?.updated_at) ? { updatedAt: string(note?.updated_at) } : {}),
            },
          }
        : {}),
      ...(input.mergeRequestIid && input.mergeRequestKey && string(input.mergeRequest?.title)
        ? {
            mergeRequest: {
              number: input.mergeRequestIid,
              sourceKey: input.mergeRequestKey,
              title: string(input.mergeRequest?.title)!,
              url:
                string(input.mergeRequest?.url) ??
                string(input.mergeRequest?.web_url) ??
                `https://${input.host}/${input.projectPath}/-/merge_requests/${input.mergeRequestIid}`,
              ...(string(input.mergeRequest?.created_at)
                ? { createdAt: string(input.mergeRequest?.created_at) }
                : {}),
              state: mergeRequestState === 'closed' || mergeRequestState === 'merged' ? ('closed' as const) : ('open' as const),
              draft: boolean(input.mergeRequest?.draft) ?? boolean(input.mergeRequest?.work_in_progress) ?? false,
              merged: input.event === 'mergeRequestMerged' || mergeRequestState === 'merged',
              assignees: usernames(input.parsed.payload.assignees ?? input.mergeRequest?.assignees),
              reviewers: usernames(input.parsed.payload.reviewers ?? input.mergeRequest?.reviewers),
              labels: labelNames(input.mergeRequest?.labels ?? input.parsed.payload.labels),
              ...(mergeRequestAuthor ? { author: mergeRequestAuthor } : {}),
              authorTrusted: input.mergeRequestAuthorTrusted,
              factoryAuthored: input.factoryAuthored,
              headBranch: string(input.mergeRequest?.source_branch) ?? '',
              baseBranch: string(input.mergeRequest?.target_branch) ?? '',
            },
          }
        : {}),
    };
    const rule = this.options.gitlab.rules[input.event];
    let decision: FactoryRuleDecision | void;
    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = rule ? await withRuleTimeout(Promise.resolve(rule(Object.freeze(context)))) : undefined;
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]).map(entry => {
          assertFactoryDecisionTarget(entry, this.options.boards, input.item ? boardForWorkItem(input.item) : undefined);
          return { ...entry };
        });
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
            : 'Factory GitLab rule failed.',
      };
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId: input.orgId,
      factoryProjectId: input.factoryProjectId,
      workItemId: input.item?.id ?? null,
      ingress: { identity: input.ingressIdentity, triggerType: `gitlab.${input.event}` },
      configVersion: this.options.configVersion,
      expectedRevision: input.item?.revision ?? null,
      actor: { ...input.actor },
      outcome,
      decisions,
      causalChain: [],
      now: new Date(),
    });
    return { status: committed.status };
  }
}

export function attachGitLabRules(
  gitlab: GitLabRulesIntegration,
  context: IntegrationContext,
): ((event: ParsedGitLabWebhook) => Promise<unknown>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new GitLabRules({
    gitlab,
    sourceControl: context.storage.sourceControl,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    intake: context.storage.intake,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
  });
  return event => rules.ingest(event);
}
