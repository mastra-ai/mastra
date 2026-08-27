import { resolveFactoryGithubRule } from '../../rules/resolve.js';
import type {
  FactoryGithubEventName,
  FactoryGithubRuleContext,
  FactoryRuleActor,
  FactoryRuleDecision,
  FactoryRules,
} from '../../rules/types.js';
import { isTerminalFactoryRuleStage } from '../../rules/types.js';
import { validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ExternalRepositoryProjectTarget,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import { FACTORY_PULL_REQUEST_RECONCILIATION_KEY } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import type { GithubAppIdentity } from './app-identity.js';
import type { GithubRepositoryPermission } from './integration.js';
import { changeRequestTargetKey } from './subscriptions.js';
import type { ParsedGithubWebhook } from './webhook.js';

const TRUSTED_PERMISSIONS = new Set(['write', 'admin']);
const RULE_TIMEOUT_MS = 5_000;
const FACTORY_TRIAGE_COMMENT_MARKER = '<!-- mastra-factory-triage -->';

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

function actorLogins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(actor => {
    const login = string(object(actor)?.login);
    return login ? [login] : [];
  });
}

function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(label => {
    if (typeof label === 'string') return label ? [label] : [];
    const name = string(object(label)?.name);
    return name ? [name] : [];
  });
}

function eventName(parsed: ParsedGithubWebhook): FactoryGithubEventName | undefined {
  const action = string(parsed.payload.action);
  if (parsed.event === 'issues' && action === 'opened') return 'issueOpened';
  if (parsed.event === 'issues' && action === 'edited') {
    const changes = object(parsed.payload.changes);
    return object(changes?.title) || object(changes?.body) ? 'issueEdited' : undefined;
  }
  if (parsed.event === 'issues' && action === 'closed') return 'issueClosed';
  if (parsed.event === 'issue_comment') {
    const issue = object(parsed.payload.issue);
    // A comment on a PR arrives as `issue_comment` with `issue.pull_request` set.
    // It routes to the PR's own event so it binds to the authoring Work item via
    // provenance instead of being mistaken for a comment on an issue of the same
    // number. Only `created` matters: edits and deletions of an existing comment
    // are not new feedback to act on.
    if (object(issue?.pull_request)) {
      return action === 'created' ? 'pullRequestCommentCreated' : undefined;
    }
    if (action === 'created') return 'issueCommentCreated';
    if (action === 'edited') return 'issueCommentEdited';
    if (action === 'deleted') return 'issueCommentDeleted';
  }
  if (parsed.event === 'pull_request' && action === 'opened') return 'pullRequestOpened';
  if (parsed.event === 'pull_request' && action === 'synchronize') return 'pullRequestUpdated';
  if (parsed.event === 'pull_request' && action === 'closed') {
    return boolean(object(parsed.payload.pull_request)?.merged) ? 'pullRequestMerged' : 'pullRequestClosed';
  }
  if (parsed.event === 'pull_request' && action === 'review_requested') return 'pullRequestReviewRequested';
  if (parsed.event === 'pull_request_review' && action === 'submitted') return 'pullRequestReviewSubmitted';
  return undefined;
}

/**
 * Canonical source keys (`github-issue:N`, `github-pr:N`) do not identify a
 * repository, so a project linked to several repositories could bind repo A's
 * event to repo B's same-numbered card. The card's intake-stamped URL is
 * authoritative; the intake-stamped `githubRepositoryId` covers URL-less
 * cards. A card with neither signal cannot be attributed by number alone.
 */
function cardBelongsToRepository(item: WorkItemRow, repositoryId: number, repositoryFullName: string): boolean {
  const url = item.externalSource?.url;
  if (url) {
    const match = /^https?:\/\/[^/]+\/(.+)\/(?:issues|pull)\/\d+(?:[/?#]|$)/.exec(url);
    if (match && match[1] === repositoryFullName) return true;
  }
  // A renamed repository leaves the old owner/name in the card URL, so a URL
  // mismatch still defers to the stable intake-stamped repository id.
  return item.metadata?.githubRepositoryId === repositoryId;
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
  readonly slug?: string;
  /**
   * Factory's own GitHub login, used to ignore its own writes. Optional because
   * not every integration can name itself; when absent, self-recognition falls
   * back to the configured slug and, failing that, to content Factory stamps
   * itself (see `FACTORY_TRIAGE_COMMENT_MARKER`).
   */
  readonly identity?: GithubAppIdentity;
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

  /**
   * Whether a login is Factory itself. Prefers the resolved identity, which is
   * observed from Factory's own writes, and falls back to the configured slug.
   * An unset slug must not silently answer "not Factory" — that is what
   * disabled every self-loop guard.
   */
  #isFactoryLogin(login: string | undefined): boolean {
    const identity = this.options.github.identity;
    if (identity?.known) return identity.matches(login);
    const slug = this.options.github.slug?.trim();
    if (!slug || !login) return false;
    return login.toLowerCase() === `${slug.toLowerCase()}[bot]`;
  }

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
  ): Promise<{ status: 'ignored' | 'committed' | 'replayed' | 'missing' }> {
    const factoryProject = await this.options.projects.get({
      orgId: project.orgId,
      id: project.factoryProjectId,
    });
    if (!factoryProject) return { status: 'missing' };
    const issue = object(parsed.payload.issue);
    const issueComment = object(parsed.payload.comment);
    const changes = object(parsed.payload.changes);
    // A comment on a PR carries the PR under `issue` (with `pull_request` set)
    // and has no `pull_request` payload of its own. Read the PR from `issue` in
    // that case so provenance and `context.pullRequest` behave as they do for
    // every other PR event, and so the number is never treated as an issue's.
    const commentOnPullRequest = object(parsed.payload.issue)?.pull_request !== undefined;
    const pullRequest = object(parsed.payload.pull_request) ?? (commentOnPullRequest ? issue : undefined);
    const issueNumber = commentOnPullRequest ? undefined : number(issue?.number);
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
    // Re-review events target the PR's own Review card, not the Work item that
    // provenance would otherwise bind the event to. For review_requested the
    // sender is whoever clicked re-request, so a Factory-authored PR must not
    // brand a human requester as factory-authored.
    const reviewRequested = event === 'pullRequestReviewRequested';
    // Provenance proves the *pull request* came from Factory, which is not the
    // same as the sender of this event. For events where the sender is whoever
    // reacted to the PR — re-requesting review, commenting, submitting a review
    // — branding them from provenance would mark every human and every review
    // bot as Factory. Only the app login identifies Factory for those.
    const senderIsResponder =
      reviewRequested || event === 'pullRequestCommentCreated' || event === 'pullRequestReviewSubmitted';
    const reReviewEvent = reviewRequested || event === 'pullRequestUpdated';
    const requestedReviewer = string(object(parsed.payload.requested_reviewer)?.login);
    const relatedItem = await this.#relatedItem(
      project.orgId,
      project.factoryProjectId,
      repositoryId,
      repositoryName,
      issueNumber,
      pullRequestNumber,
      string(object(pullRequest?.head)?.ref),
      reReviewEvent ? null : provenance,
      senderIsResponder && !reviewRequested,
    );
    const actor = await githubActor(this.options.github, {
      installationId,
      repository: repositoryName,
      login,
      factoryAuthored: (!senderIsResponder && provenance !== null) || this.#isFactoryLogin(login),
    });
    // A marked handoff comment is ignored only when Factory authored it: a
    // human may quote the marker to add an investigation lead, and that must
    // still retrigger triage. Recognising the author is therefore the whole
    // guard — when identity cannot be resolved this fails open and Factory's
    // own handoff cancels the run that wrote it.
    if (
      actor.type === 'github' &&
      actor.factoryAuthored &&
      (event === 'issueCommentCreated' || event === 'issueCommentEdited') &&
      string(issueComment?.body)?.includes(FACTORY_TRIAGE_COMMENT_MARKER)
    ) {
      return { status: 'ignored' };
    }
    // One delivery can concern two cards — a merged pull request settles both
    // its own Review card and the Work item that authored it — and every
    // decision a rule returns is committed against a single item, at that
    // item's revision. So the evaluation, not the decision, is what fans out:
    // the rule runs once per bound item, each with its own ingress identity.
    const evaluate = async (
      item: WorkItemRow | undefined,
      ingressIdentity: string,
    ): Promise<{ status: 'ignored' | 'committed' | 'replayed' | 'missing' }> => {
      const context: FactoryGithubRuleContext = {
        tenant: { orgId: project.orgId, projectId: project.factoryProjectId },
        actor,
        ingress: { type: 'github', id: ingressIdentity },
        cause: `github.${event}`,
        causalChain: [],
        ruleSetVersion: this.options.rules.version,
        ...(item
          ? {
              item: {
                id: item.id,
                source: workItemSource(item),
                sourceKey: workItemSourceKey(item),
                parentWorkItemId: item.parentWorkItemId,
                title: item.title,
                url: item.externalSource?.url ?? null,
                stages: item.stages,
                metadata: item.metadata,
              },
              board: item.externalSource?.type === 'pull-request' ? ('review' as const) : ('work' as const),
              itemRevision: item.revision,
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
                ...(string(issue?.updated_at) ? { updatedAt: string(issue?.updated_at) } : {}),
                assignees: actorLogins(issue?.assignees),
                labels: labelNames(issue?.labels),
                ...(string(issue?.state) === 'closed' || string(issue?.state) === 'open'
                  ? { state: string(issue?.state) as 'open' | 'closed' }
                  : {}),
                ...(string(issue?.state_reason) ? { stateReason: string(issue?.state_reason) } : {}),
              },
            }
          : {}),
        ...(event === 'issueEdited'
          ? { issueChange: { title: Boolean(object(changes?.title)), body: Boolean(object(changes?.body)) } }
          : {}),
        ...(number(issueComment?.id)
          ? {
              issueComment: {
                id: number(issueComment?.id)!,
                ...(string(issueComment?.body) ? { body: string(issueComment?.body) } : {}),
                ...(string(issueComment?.html_url) ? { url: string(issueComment?.html_url) } : {}),
                ...(string(object(issueComment?.user)?.login)
                  ? { author: string(object(issueComment?.user)?.login) }
                  : {}),
                ...(string(object(issueComment?.user)?.type)
                  ? { authorType: string(object(issueComment?.user)?.type) }
                  : {}),
                ...(string(issueComment?.created_at) ? { createdAt: string(issueComment?.created_at) } : {}),
                ...(string(issueComment?.updated_at) ? { updatedAt: string(issueComment?.updated_at) } : {}),
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
                draft: boolean(pullRequest?.draft) ?? false,
                merged: boolean(pullRequest?.merged) ?? false,
                assignees: actorLogins(pullRequest?.assignees),
                requestedReviewers: actorLogins(pullRequest?.requested_reviewers),
                labels: labelNames(pullRequest?.labels),
                headBranch: string(object(pullRequest?.head)?.ref) ?? '',
                baseBranch: string(object(pullRequest?.base)?.ref) ?? '',
              },
            }
          : {}),
        ...(reviewRequested && requestedReviewer
          ? {
              reviewRequest: {
                reviewer: requestedReviewer,
                factoryReviewer: this.#isFactoryLogin(requestedReviewer),
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
        workItemId: item?.id ?? null,
        ingress: { identity: ingressIdentity, triggerType: `github.${event}` },
        ruleSetVersion: this.options.rules.version,
        expectedRevision: item?.revision ?? null,
        actor: { ...actor },
        outcome,
        decisions,
        causalChain: [],
        now: new Date(),
      });
      return { status: committed.status };
    };

    const deliveryIdentity = `${installationId}:${parsed.deliveryId}`;
    const primary = await evaluate(relatedItem, deliveryIdentity);
    // A merged pull request is the one event both linked cards need: the
    // Review card has to close, and the Work item that wrote the code has to
    // assess whether it is finished. Resolution binds the delivery to whichever
    // card it matched first, so evaluate the other one too — under an identity
    // suffixed with its id, because ingress identities are the replay key and
    // reusing the delivery's own would drop this evaluation as a duplicate.
    const linked =
      event === 'pullRequestMerged' && relatedItem && pullRequestNumber
        ? await this.#linkedClosureItem(
            project.orgId,
            project.factoryProjectId,
            repositoryId,
            repositoryName,
            pullRequestNumber,
            relatedItem,
          )
        : undefined;
    if (!linked) return primary;
    const secondary = await evaluate(linked, `${deliveryIdentity}:${linked.id}`);
    for (const status of ['committed', 'replayed'] as const) {
      if (primary.status === status || secondary.status === status) return { status };
    }
    return primary;
  }

  /**
   * The other card a closed pull request concerns, joined through the Review
   * card's `parentWorkItemId` — the link `upsertLinkedWorkItem` records when the
   * pull request is opened, and therefore an exact join that needs no branch
   * heuristics. Returns nothing when the pull request has only one card, which
   * is every pull request Factory did not open from a work item's session.
   */
  async #linkedClosureItem(
    orgId: string,
    projectId: string,
    repositoryId: number,
    repositoryFullName: string,
    pullRequestNumber: number,
    resolved: WorkItemRow,
  ): Promise<WorkItemRow | undefined> {
    const items = await this.options.storage.list({ orgId, factoryProjectId: projectId });
    const linked =
      resolved.externalSource?.type === 'pull-request'
        ? // Bound to the pull request's own Review card: follow the recorded
          // link back to the work item that authored it.
          items.find(item => item.id === resolved.parentWorkItemId)
        : // Bound to the work item (provenance): find the Review card this pull
          // request opened, and only when it names this item as its parent — a
          // card for the same number in another repository is not this one's.
          items.find(
            item =>
              item.parentWorkItemId === resolved.id &&
              (item.externalSource?.externalId === canonicalSourceKey('pull-request', pullRequestNumber) ||
                item.externalSource?.externalId === legacySourceKey(repositoryId, 'pull-request', pullRequestNumber)) &&
              cardBelongsToRepository(item, repositoryId, repositoryFullName),
          );
    return linked?.id === resolved.id ? undefined : linked;
  }

  async #relatedItem(
    orgId: string,
    projectId: string,
    repositoryId: number,
    repositoryFullName: string,
    issueNumber: number | undefined,
    pullRequestNumber: number | undefined,
    pullRequestHeadBranch: string | undefined,
    provenance: FactoryPullRequestProvenanceData | null,
    preferAuthoringItem = false,
  ): Promise<WorkItemRow | undefined> {
    const items = await this.options.storage.list({ orgId, factoryProjectId: projectId });
    const resolved = this.#resolveItem(
      items,
      repositoryId,
      repositoryFullName,
      issueNumber,
      pullRequestNumber,
      pullRequestHeadBranch,
      provenance,
    );
    // Feedback on a pull request has to reach the item that *wrote* the code.
    // Provenance normally lands it there directly, but when provenance is
    // missing the PR-number lookup wins and returns the PR's own Review card
    // instead — a board the feedback rules deliberately refuse to act on, so
    // the wake is silently dropped. The linked card records its author in
    // `parentWorkItemId`, so follow that link back rather than relaxing the
    // guard, which would let a Review card react to its own posted review.
    if (preferAuthoringItem && resolved?.externalSource?.type === 'pull-request' && resolved.parentWorkItemId) {
      return items.find(item => item.id === resolved.parentWorkItemId) ?? resolved;
    }
    return resolved;
  }

  #resolveItem(
    items: WorkItemRow[],
    repositoryId: number,
    repositoryFullName: string,
    issueNumber: number | undefined,
    pullRequestNumber: number | undefined,
    pullRequestHeadBranch: string | undefined,
    provenance: FactoryPullRequestProvenanceData | null,
  ): WorkItemRow | undefined {
    if (provenance) return items.find(item => item.id === provenance.workItemId);
    if (issueNumber) {
      return (
        items.find(
          item =>
            item.externalSource?.externalId === canonicalSourceKey('issue', issueNumber) &&
            cardBelongsToRepository(item, repositoryId, repositoryFullName),
        ) ?? items.find(item => item.externalSource?.externalId === legacySourceKey(repositoryId, 'issue', issueNumber))
      );
    }
    if (pullRequestNumber) {
      return (
        items.find(
          item =>
            item.externalSource?.externalId === canonicalSourceKey('pull-request', pullRequestNumber) &&
            cardBelongsToRepository(item, repositoryId, repositoryFullName),
        ) ??
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
  draft: boolean;
  merged: boolean;
  assignees?: string[];
  requestedReviewers?: string[];
  labels?: string[];
  headBranch: string;
  baseBranch: string;
  author?: string;
  createdAt?: string;
  mergedBy?: string;
}

export type GithubPullRequestFetcher = (input: {
  installationId: number;
  repository: string;
  number: number;
}) => Promise<ReconcilePullRequestState | undefined>;

export interface ReconcileIssueState {
  title: string;
  url: string;
  state: 'open' | 'closed';
  /** GitHub close reason: `completed`, `not_planned`, or `duplicate`. */
  stateReason?: string;
  assignees?: string[];
  labels?: string[];
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type GithubIssueFetcher = (input: {
  installationId: number;
  repository: string;
  number: number;
}) => Promise<ReconcileIssueState | undefined>;

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
  /** PRs/issues (or whole repositories) skipped because of an error. */
  failed: number;
  /** Error samples with context, capped at {@link RECONCILE_ERROR_SAMPLE_LIMIT}. */
  errors: Array<{ repository: string; pullRequestNumber?: number; issueNumber?: number; error: string }>;
}

export type GithubPullRequestReconciler = (repositories: ReconcileRepository[]) => Promise<ReconcileSweepSummary>;

export const RECONCILE_ERROR_SAMPLE_LIMIT = 5;

export function sameStrings(left: unknown, right: string[] | undefined): boolean {
  if (right === undefined) return true;
  if (!Array.isArray(left)) return false;
  const leftValues = new Set(left.flatMap(value => (typeof value === 'string' ? [value] : [])));
  const rightValues = new Set(right);
  return leftValues.size === rightValues.size && [...leftValues].every(value => rightValues.has(value));
}

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

/**
 * Extracts the issue number a work item tracks, but only when the item
 * belongs to the given repository. Stricter than
 * {@link reconcilablePullRequestNumber}: a canonical key with no URL is only
 * trusted when the intake-stamped `githubRepositoryId` confirms the
 * repository, because the sweep initiates closes on its own.
 */
export function reconcilableIssueNumber(item: WorkItemRow, repository: ReconcileRepository): number | undefined {
  if (item.externalSource?.type !== 'issue') return undefined;
  const url = item.externalSource.url;
  if (url) {
    const match = /^https?:\/\/[^/]+\/(.+)\/issues\/(\d+)(?:[/?#]|$)/.exec(url);
    if (!match) return undefined;
    // A renamed repository leaves the old owner/name in the card URL, so a
    // URL mismatch still defers to the stable intake-stamped repository id.
    const belongs = match[1] === repository.fullName || item.metadata?.githubRepositoryId === repository.id;
    return belongs ? Number(match[2]) : undefined;
  }
  const externalId = item.externalSource.externalId;
  const legacy = /^github:(\d+):issue:(\d+)$/.exec(externalId);
  if (legacy) return Number(legacy[1]) === repository.id ? Number(legacy[2]) : undefined;
  const canonical = /^github-issue:(\d+)$/.exec(externalId);
  if (!canonical) return undefined;
  // Canonical keys carry no repository; only the intake-stamped repository id
  // can attribute a URL-less card, and guessing would let a multi-repo
  // project close repo B's card because repo A's same-numbered issue closed.
  return item.metadata?.githubRepositoryId === repository.id ? Number(canonical[1]) : undefined;
}

export function reconciledIssueClosedEvent(
  repository: ReconcileRepository,
  issueNumber: number,
  state: ReconcileIssueState,
): ParsedGithubWebhook {
  return {
    event: 'issues',
    // Stable per (repository, issue): the ingress dedupe makes repeat
    // reconcile cycles replay instead of re-committing decisions.
    deliveryId: `reconcile:${repository.id}:issue:${issueNumber}:closed`,
    payload: {
      action: 'closed',
      installation: { id: repository.installationId },
      repository: { id: repository.id, full_name: repository.fullName },
      sender: { login: state.author ?? 'github' },
      issue: {
        number: issueNumber,
        title: state.title,
        html_url: state.url,
        state: 'closed',
        ...(state.stateReason ? { state_reason: state.stateReason } : {}),
        ...(state.createdAt ? { created_at: state.createdAt } : {}),
        ...(state.updatedAt ? { updated_at: state.updatedAt } : {}),
        assignees: (state.assignees ?? []).map(login => ({ login })),
      },
    },
  };
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
        draft: state.draft,
        merged: state.merged,
        assignees: (state.assignees ?? []).map(login => ({ login })),
        requested_reviewers: (state.requestedReviewers ?? []).map(login => ({ login })),
        labels: (state.labels ?? []).map(name => ({ name })),
        head: { ref: state.headBranch },
        base: { ref: state.baseBranch },
      },
    },
  };
}

function reconciledPullRequestMetadata(
  state: ReconcilePullRequestState,
  reconciliation: 'clear' | 'settled',
): Record<string, unknown> {
  return {
    state: state.state,
    draft: state.draft,
    merged: state.merged,
    ...(state.author ? { author: state.author } : {}),
    ...(state.assignees ? { assignees: state.assignees } : {}),
    ...(state.requestedReviewers ? { requestedReviewers: state.requestedReviewers } : {}),
    ...(state.labels ? { labels: state.labels } : {}),
    [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]:
      reconciliation === 'settled' ? (state.merged ? 'merged' : 'closed') : null,
  };
}

function reconciledPullRequestOutcome(metadata: Record<string, unknown>): 'merged' | 'closed' | undefined {
  if (metadata.state !== 'closed' || typeof metadata.merged !== 'boolean') return undefined;
  return metadata.merged ? 'merged' : 'closed';
}

/**
 * The webhook handler retires subscriptions itself; the sweep replays only the
 * rules ingress, so without this the thread's PR chip and the workspace row
 * stay `open` forever on a deployment GitHub cannot reach.
 */
async function retireReconciledSubscriptions(
  storage: IntegrationStorageHandle,
  repository: ReconcileRepository,
  pullRequestNumber: number,
  merged: boolean,
): Promise<void> {
  const target = changeRequestTargetKey({
    installationExternalId: String(repository.installationId),
    repositoryExternalId: String(repository.id),
    changeRequestId: String(pullRequestNumber),
  });
  const rows = await storage.subscriptions.listByTarget(target);
  await Promise.all(
    rows
      .filter(row => row.status === 'open')
      .map(row => storage.subscriptions.updateStatus(row.id, merged ? 'merged' : 'closed')),
  );
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
    const summary: ReconcileSweepSummary = {
      repositories: 0,
      checked: 0,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    };
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
      let cardsByNumber: Map<number, WorkItemRow[]>;
      try {
        const projects = await options.sourceControl.projectRepositories.listByExternalRepository({
          installationExternalId: String(repository.installationId),
          repositoryExternalId: String(repository.id),
        });
        if (projects.length === 0) continue;
        cardsByNumber = new Map<number, WorkItemRow[]>();
        for (const project of projects) {
          const items = await options.storage.list({
            orgId: project.orgId,
            factoryProjectId: project.factoryProjectId,
          });
          for (const item of items) {
            const stage = item.stages[0];
            const pullRequestNumber = reconcilablePullRequestNumber(item, repository);
            if (!pullRequestNumber) continue;
            const metadata = item.metadata ?? {};
            const reconciliation = metadata[FACTORY_PULL_REQUEST_RECONCILIATION_KEY];
            const reconciledOutcome = reconciledPullRequestOutcome(metadata);
            if (
              (stage === 'done' || stage === 'canceled') &&
              reconciledOutcome !== undefined &&
              reconciliation === reconciledOutcome
            ) {
              continue;
            }
            const cards = cardsByNumber.get(pullRequestNumber) ?? [];
            cards.push(item);
            cardsByNumber.set(pullRequestNumber, cards);
          }
        }
      } catch (error) {
        recordFailure(repository, error);
        continue;
      }
      for (const [pullRequestNumber, cards] of cardsByNumber) {
        try {
          const state = await fetchPullRequest({
            installationId: repository.installationId,
            repository: repository.fullName,
            number: pullRequestNumber,
          });
          summary.checked += 1;
          if (!state) continue;
          for (const card of cards) {
            if (state.state === 'closed') continue;
            const metadata = card.metadata ?? {};
            const statusChanged =
              metadata.state !== state.state || metadata.draft !== state.draft || metadata.merged !== state.merged;
            const authorChanged = state.author !== undefined && metadata.author !== state.author;
            const assigneesChanged = !sameStrings(metadata.assignees, state.assignees);
            const reviewersChanged = !sameStrings(metadata.requestedReviewers, state.requestedReviewers);
            const labelsChanged = !sameStrings(metadata.labels, state.labels);
            const metadataChanged =
              statusChanged || authorChanged || assigneesChanged || reviewersChanged || labelsChanged;
            const reconciliation = metadata[FACTORY_PULL_REQUEST_RECONCILIATION_KEY];
            if (!metadataChanged && reconciliation !== 'merged' && reconciliation !== 'closed') continue;
            try {
              await options.storage.update({
                orgId: card.orgId,
                id: card.id,
                userId: 'factory-rule-dispatcher',
                patch: { metadata: reconciledPullRequestMetadata(state, 'clear') },
              });
            } catch (error) {
              recordFailure(repository, error, pullRequestNumber);
            }
          }
          if (state.state !== 'closed') continue;
          const cleanupFailures = new Set<string>();
          for (const card of cards) {
            if (!isTerminalFactoryRuleStage(card.stages)) continue;
            try {
              await options.storage.supersedeDecisionsForWorkItem({
                orgId: card.orgId,
                factoryProjectId: card.factoryProjectId,
                workItemId: card.id,
                supersededAt: new Date(),
              });
            } catch (error) {
              recordFailure(repository, error, pullRequestNumber);
              cleanupFailures.add(card.id);
            }
          }
          await rules.ingest(reconciledClosedEvent(repository, pullRequestNumber, state));
          await retireReconciledSubscriptions(options.integrationStorage, repository, pullRequestNumber, state.merged);
          for (const card of cards) {
            if (cleanupFailures.has(card.id)) continue;
            try {
              await options.storage.update({
                orgId: card.orgId,
                id: card.id,
                userId: 'factory-rule-dispatcher',
                patch: { metadata: reconciledPullRequestMetadata(state, 'settled') },
              });
            } catch (error) {
              recordFailure(repository, error, pullRequestNumber);
            }
          }
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

export function githubRulesOptions(
  github: GithubRulesIntegration,
  context: IntegrationContext,
): GithubRulesOptions | undefined {
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
