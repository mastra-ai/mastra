import { createHash } from 'node:crypto';

import { routedBoardEvent, routeEventMoves } from '../../boards/event-routing.js';
import {
  boardEventHandlers,
  boardForWorkItem,
  eventBoardId,
  rulePhaseField,
  withBoardClosure,
  workItemPhaseSemantics,
} from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import { matchIntakeRoute, pullRequestIntakeRoutes } from '../../boards/intake-routing.js';
import { cardLabels, moveCardToBoard } from '../../boards/relocate.js';
import type { BoardResolver } from '../../boards/resolver.js';
import { currentBoardId } from '../../boards/semantics.js';
import { hasExplicitRuleOverride, selectEventRule } from '../../rules/event-rules.js';
import type {
  FactoryGithubEventName,
  FactoryGithubRuleContext,
  FactoryRuleActor,
  FactoryRuleDecision,
} from '../../rules/types.js';
import { isTerminalFactoryRuleStage } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import { resolveIntakeLabelRoute } from '../../storage/domains/intake/base.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { IntegrationStorageHandle } from '../../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type {
  ExternalRepositoryProjectTarget,
  SourceControlStorageHandle,
} from '../../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import {
  FACTORY_PULL_REQUEST_RECONCILIATION_KEY,
  externalSourceKey,
  WorkItemUpdateConflictError,
} from '../../storage/domains/work-items/base.js';
import type { IntegrationContext, IntegrationHooks } from '../base.js';
import { recordPullRequestHead } from '../pull-request-head.js';
import type { GithubAppIdentity } from './app-identity.js';
import type { GithubEventRules } from './default-rules.js';
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

function timestamp(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
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

function sameLabels(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((label, index) => label === b[index]);
}

function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(label => {
    if (typeof label === 'string') return label ? [label] : [];
    const name = string(object(label)?.name);
    return name ? [name] : [];
  });
}

function parseFactoryReviewCommand(
  body: string | undefined,
  target: string | undefined,
): { command: 'review' | 're-review'; target: string } | undefined {
  if (!body || !target) return undefined;
  const firstLine = body
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0)
    ?.toLowerCase();
  if (!firstLine) return undefined;
  const mention = `@${target.toLowerCase().replace(/\[bot\]$/, '')}`;
  if (firstLine === `${mention} review`) return { command: 'review', target };
  if (firstLine === `${mention} re-review`) return { command: 're-review', target };
  return undefined;
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
const MAX_STALE_RULE_ATTEMPTS = 3;

export function cardBelongsToRepository(item: WorkItemRow, repositoryId: number, repositoryFullName: string): boolean {
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

/** The link key a GitHub pull request is stored under: the same key its own card's source uses. */
export function githubPullRequestLinkKey(repositoryId: number, pullRequestNumber: number): string {
  return externalSourceKey({
    integrationId: 'github',
    type: 'pull-request',
    externalId: `github:${repositoryId}:pull-request:${pullRequestNumber}`,
  })!;
}

/** Cards folded into another card (a pull request's old card) no longer receive events. */
function unfolded(items: WorkItemRow[]): WorkItemRow[] {
  return items.filter(item => typeof item.metadata?.foldedInto !== 'string');
}

const CLOSING_REFERENCE =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:([\w.-]+\/[\w.-]+)#|https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/|#)(\d+)\b/gi;

/** Issue numbers in this repository a pull request body says it closes, in order. */
export function closingIssueNumbers(body: string | undefined, repositoryFullName: string): number[] {
  if (!body) return [];
  const numbers: number[] = [];
  for (const match of body.matchAll(CLOSING_REFERENCE)) {
    const repository = match[1] ?? match[2];
    if (repository && repository.toLowerCase() !== repositoryFullName.toLowerCase()) continue;
    const value = Number(match[3]);
    if (Number.isSafeInteger(value) && value > 0 && !numbers.includes(value)) numbers.push(value);
  }
  return numbers;
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

// Throws on a failed lookup: callers writing permanent state must retry, not
// record the failure as distrust.
export async function trustedCollaborator(
  github: GithubRulesIntegration,
  input: { installationId: number; repository: string; login: string },
): Promise<boolean> {
  const permission = await github.getRepositoryCollaboratorPermission(
    input.installationId,
    input.repository,
    input.login,
  );
  return permission !== undefined && TRUSTED_PERMISSIONS.has(permission);
}

// Terminal cards leave the reconcile loop below, so the ones that got there before author
// trust was recorded have no other path to an answer.
function authorAwaitingTrust(item: WorkItemRow, repository: ReconcileRepository): string | undefined {
  const metadata = item.metadata ?? {};
  if (typeof metadata.author !== 'string' || metadata.authorTrusted !== undefined) return undefined;
  const tracked = reconcilablePullRequestNumber(item, repository) ?? reconcilableIssueNumber(item, repository);
  if (tracked === undefined) return undefined;
  // A canonical key with no URL names no repository, and the pull request matcher takes it anyway.
  // Asking GitHub about the wrong repository of a multi-repository project would record a wrong answer.
  const unattributed =
    !item.externalSource?.url && /^github-(?:pr|issue):\d+$/.test(item.externalSource?.externalId ?? '');
  if (unattributed && metadata.githubRepositoryId !== repository.id) return undefined;
  return metadata.author;
}

export function sweepTrustLookup(
  github: GithubRulesIntegration,
  repository: ReconcileRepository,
): (login: string) => Promise<boolean> {
  const cache = new Map<string, boolean>();
  return async login => {
    const cached = cache.get(login);
    if (cached !== undefined) return cached;
    const trusted = await trustedCollaborator(github, {
      installationId: repository.installationId,
      repository: repository.fullName,
      login,
    });
    cache.set(login, trusted);
    return trusted;
  };
}

async function githubActor(
  github: GithubRulesIntegration,
  input: { installationId: number; repository: string; login: string; factoryAuthored: boolean },
): Promise<FactoryRuleActor> {
  // The actor bit is recomputed on every event, so a failed lookup can read
  // untrusted for this one delivery instead of failing the ingest.
  const trusted = await trustedCollaborator(github, input).catch(() => false);
  return { type: 'github', login: input.login, trusted, factoryAuthored: input.factoryAuthored };
}

interface FactoryPullRequestProvenanceData {
  kind: 'factory-pr-provenance';
  workItemId: string;
}

function pullRequestProvenance(
  data: Record<string, unknown> | undefined,
  factoryProjectId: string,
): FactoryPullRequestProvenanceData | null {
  if (!data || data.kind !== 'factory-pr-provenance' || typeof data.workItemId !== 'string') return null;
  // Provenance proves which Factory *project's* run authored the PR. A row
  // written by a sibling project in the same org — or a legacy row without the
  // project stamp — fails closed here: honoring it would brand the PR
  // Factory-authored in a project that never touched it, and auto-start a
  // review that checks out and executes the PR there.
  if (data.factoryProjectId !== factoryProjectId) return null;
  return { kind: 'factory-pr-provenance', workItemId: data.workItemId };
}

export interface GithubRulesIntegration {
  readonly rules: GithubEventRules;
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
  configVersion: string;
  boards: BoardRegistry;
  /** Each project's boards and stored intake routes; `boards` and the legacy intake rows are used without it. */
  boardResolver?: BoardResolver;
  /**
   * Decides which installed board an issue lands on: a label route first, then the repository's
   * intake source binding. Absent means Work.
   */
  intake?: Pick<IntakeStorage, 'listLabelRoutes' | 'listBindings'>;
  /** Hands a push to a linked repository off for an environment build. */
  onRepositoryPush?: IntegrationHooks['onRepositoryPush'];
}

/** Identity under which label-driven relocations are recorded. */
const LABEL_ROUTE_USER_ID = 'factory-rule-dispatcher';

type IssueActionHandler = (
  parsed: ParsedGithubWebhook,
  repositoryId: number,
  repositoryName: string,
  project: ExternalRepositoryProjectTarget,
) => Promise<{ status: 'ignored' | 'committed' }>;

/**
 * Whether a login is Factory itself. Prefers the resolved identity, which is
 * observed from Factory's own writes, and falls back to the configured slug.
 */
export function isFactoryGithubLogin(
  github: Pick<GithubRulesIntegration, 'identity' | 'slug'>,
  login: string | null | undefined,
): boolean {
  if (github.identity?.known) return github.identity.matches(login);
  const slug = github.slug?.trim();
  if (!slug || !login) return false;
  return login.toLowerCase() === `${slug.toLowerCase()}[bot]`;
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
    return isFactoryGithubLogin(this.options.github, login);
  }

  #factoryMentionTarget(): string | undefined {
    const identity = this.options.github.identity;
    if (identity?.known) return identity.login;
    const slug = this.options.github.slug?.trim();
    return slug ? `${slug.toLowerCase()}[bot]` : undefined;
  }

  /**
   * Board and phase an issue lands on. Stored intake routes with a condition go first, then the
   * project's label routes, then the board the repository's intake source binding names, then a
   * stored fallback route. Only installed boards count. Undefined leaves built-in routing (Work)
   * in charge.
   */
  /** A stored board's event routes decide where the rule's proposed card move lands (see `routeEventMoves`). */
  async #routeEventMoves(
    project: { orgId: string; factoryProjectId: string },
    event: FactoryGithubEventName,
    item: WorkItemRow | null | undefined,
    context: FactoryGithubRuleContext,
    decisions: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const resolver = this.options.boardResolver;
    const boardEvent = routedBoardEvent(event);
    if (!resolver || !item || !boardEvent || context.pullRequestIntake) return decisions;
    if (hasExplicitRuleOverride(this.options.github.rules, event)) return decisions;
    const board = boardForWorkItem(item);
    const routes = await resolver.eventRoutes(project, board);
    if (!routes) return decisions;
    const pullRequestKey = context.pullRequest
      ? githubPullRequestLinkKey(context.repository.id, context.pullRequest.number)
      : undefined;
    const links = await this.options.storage.listSources({ ...project, workItemId: item.id });
    const pullRequestLinks = links.filter(link => link.kind === 'pull_request');
    const openPullRequestNumber = item.metadata?.openPullRequestNumber;
    // A pull request's own card links it under its intake key, not the key Factory links authored ones with.
    const ownKey = item.externalSource?.type === 'pull-request' ? externalSourceKey(item.externalSource) : null;
    // Only a pull request the card owns holds it open: one Factory opened, or the one it has out. A
    // linked pull request an outsider opened ("fixes #N") must not keep the card from closing.
    const ownsLink = (link: (typeof pullRequestLinks)[number]) =>
      link.factoryAuthored ||
      (typeof openPullRequestNumber === 'number' && link.external.number === openPullRequestNumber);
    const hasOtherOpenPullRequest = pullRequestLinks.length
      ? pullRequestLinks.some(
          link =>
            link.state === 'open' && link.sourceKey !== pullRequestKey && link.sourceKey !== ownKey && ownsLink(link),
        )
      : typeof openPullRequestNumber === 'number' && openPullRequestNumber !== context.pullRequest?.number;
    return routeEventMoves({
      decisions: decisions as { type: string }[],
      routes,
      event: boardEvent,
      board,
      fromPhase: item.stages.length === 1 ? item.stages[0] : undefined,
      facts: {
        'pullRequest.merged': context.pullRequest?.merged,
        'pullRequest.draft': context.pullRequest?.draft,
        'pullRequest.factoryAuthored': context.pullRequest?.factoryAuthored,
        'issue.stateReason': context.issue?.stateReason,
        'item.hasOtherOpenPullRequest': hasOtherOpenPullRequest,
        'item.sourceKind': item.externalSource?.type === 'pull-request' ? 'pull_request' : 'issue',
        'actor.trusted': context.actor.type === 'github' ? context.actor.trusted : undefined,
      },
    }) as Record<string, unknown>[];
  }

  async #intakeTarget(
    project: ExternalRepositoryProjectTarget,
    repositoryName: string,
    labels: readonly string[],
    pullRequest?: { draft: boolean; author: string | undefined },
  ): Promise<{ board: string; initialPhase: string } | undefined> {
    const { orgId, factoryProjectId } = project;
    const resolver = this.options.boardResolver;
    const boards = resolver ? await resolver.forProject(project) : this.options.boards;
    const stored = resolver ? await resolver.intakeRoutes(project) : [];
    const facts = {
      'source.kind': pullRequest ? 'pull_request' : 'issue',
      'source.integration': 'github',
      'source.repository': repositoryName,
      'item.labels': labels,
      ...(pullRequest ? { 'item.draft': pullRequest.draft, 'item.author': pullRequest.author } : {}),
    };
    const routed = matchIntakeRoute(
      pullRequest ? pullRequestIntakeRoutes(stored) : stored.filter(route => route.when),
      facts,
      boards,
    );
    if (routed) return { board: routed.board, initialPhase: routed.phase };
    if (pullRequest) return undefined;
    const fallback = () => {
      const target = matchIntakeRoute(
        stored.filter(route => !route.when),
        facts,
        boards,
      );
      return target ? { board: target.board, initialPhase: target.phase } : undefined;
    };
    const intake = this.options.intake;
    if (!intake) return fallback();
    if (labels.length > 0) {
      const routes = await intake.listLabelRoutes({ orgId, factoryProjectId, integrationId: 'github' });
      const route = resolveIntakeLabelRoute(routes, labels);
      const board = route ? boards.get(currentBoardId(route.board)) : undefined;
      if (board) return { board: board.id, initialPhase: board.initialPhase };
    }
    // GitHub bindings are keyed by the internal repository id; the slug is accepted too since the
    // bindings API stores whatever source id it is given.
    const slug = repositoryName.toLowerCase();
    const binding = (await intake.listBindings({ orgId, integrationId: 'github' })).find(
      candidate =>
        candidate.factoryProjectId === factoryProjectId &&
        (candidate.sourceId === project.projectRepository.repositoryId || candidate.sourceId.toLowerCase() === slug),
    );
    const board = binding?.board ? boards.get(currentBoardId(binding.board)) : undefined;
    return board ? { board: board.id, initialPhase: board.initialPhase } : fallback();
  }

  /**
   * `labeled` / `unlabeled` are not rule events: the labels only decide which board the card belongs
   * on, so the card is re-routed here and its label metadata refreshed. Cards a run owns, and
   * finished cards, stay where they are.
   */
  async #relocateLabeledIssue(
    parsed: ParsedGithubWebhook,
    repositoryId: number,
    repositoryName: string,
    project: ExternalRepositoryProjectTarget,
  ): Promise<{ status: 'ignored' | 'committed' }> {
    const issue = object(parsed.payload.issue);
    const issueNumber = issue?.pull_request === undefined ? number(issue?.number) : undefined;
    if (!issueNumber) return { status: 'ignored' };
    const found = await this.#relatedItem(
      project.orgId,
      project.factoryProjectId,
      repositoryId,
      repositoryName,
      issueNumber,
      undefined,
      undefined,
      null,
    );
    if (!found || found.externalSource?.type !== 'issue') return { status: 'ignored' };
    const labels = labelNames(issue?.labels);
    let item = found;
    let changed = false;
    if (!sameLabels(cardLabels(item), labels)) {
      let updated;
      try {
        updated = await this.options.storage.update({
          orgId: item.orgId,
          id: item.id,
          userId: LABEL_ROUTE_USER_ID,
          patch: { metadata: { ...(item.metadata ?? {}), labels } },
          expectedRevision: item.revision,
        });
      } catch (error) {
        // The card changed under us (a run wrote it, or a concurrent delivery won). The next
        // delivery or reconcile pass carries the same labels, so drop this one instead of 5xx-ing.
        if (!(error instanceof WorkItemUpdateConflictError)) throw error;
        return { status: 'ignored' };
      }
      if (!updated) return { status: 'ignored' };
      item = updated.item;
      changed = true;
    }
    const target = await this.#intakeTarget(project, repositoryName, labels);
    const outcome = await moveCardToBoard({
      workItems: this.options.storage,
      boardRegistry: this.options.boardResolver
        ? await this.options.boardResolver.forProject(project)
        : this.options.boards,
      userId: LABEL_ROUTE_USER_ID,
      item,
      targetBoard: target?.board ?? 'work',
    });
    return { status: changed || outcome === 'moved' ? 'committed' : 'ignored' };
  }

  /**
   * `assigned` / `unassigned` are not rule events either: an existing issue card only mirrors the
   * issue's full assignee list. No card is created, moved, or handed to a run.
   */
  async #syncIssueAssignees(
    parsed: ParsedGithubWebhook,
    repositoryId: number,
    repositoryName: string,
    project: ExternalRepositoryProjectTarget,
  ): Promise<{ status: 'ignored' | 'committed' }> {
    const issue = object(parsed.payload.issue);
    const issueNumber = issue?.pull_request === undefined ? number(issue?.number) : undefined;
    if (!issueNumber) return { status: 'ignored' };
    const item = await this.#relatedItem(
      project.orgId,
      project.factoryProjectId,
      repositoryId,
      repositoryName,
      issueNumber,
      undefined,
      undefined,
      null,
    );
    if (!item || item.externalSource?.type !== 'issue') return { status: 'ignored' };
    const assignees = actorLogins(issue?.assignees);
    // GitHub can deliver webhooks out of order; drop payloads older than the last applied one.
    // Timestamps have one-second resolution, so equal timestamps still apply.
    const updatedAt = string(issue?.updated_at);
    const payloadTime = timestamp(updatedAt);
    const storedTime = timestamp(item.metadata?.githubAssigneesUpdatedAt);
    if (payloadTime !== undefined && storedTime !== undefined && payloadTime < storedTime) {
      return { status: 'ignored' };
    }
    // A newer payload with unchanged assignees still advances the stored time, so a delayed older
    // payload cannot slip in behind it.
    const advancesTime = payloadTime !== undefined && (storedTime === undefined || payloadTime > storedTime);
    if (sameStrings(item.metadata?.assignees, assignees) && !advancesTime) return { status: 'ignored' };
    try {
      const updated = await this.options.storage.update({
        orgId: item.orgId,
        id: item.id,
        userId: LABEL_ROUTE_USER_ID,
        patch: {
          metadata: {
            ...(item.metadata ?? {}),
            assignees,
            ...(payloadTime !== undefined ? { githubAssigneesUpdatedAt: updatedAt } : {}),
          },
        },
        expectedRevision: item.revision,
      });
      return { status: updated ? 'committed' : 'ignored' };
    } catch (error) {
      // A concurrent write won; nothing reconciles issue-card assignees, so they stay as the
      // winner left them until the next assigned/unassigned delivery for this issue.
      if (!(error instanceof WorkItemUpdateConflictError)) throw error;
      return { status: 'ignored' };
    }
  }

  /** `issues` actions that are not rule events but still update an existing card. */
  #issueActionHandler(parsed: ParsedGithubWebhook): IssueActionHandler | undefined {
    if (parsed.event !== 'issues') return undefined;
    switch (string(parsed.payload.action)) {
      case 'labeled':
      case 'unlabeled':
        return (...args) => this.#relocateLabeledIssue(...args);
      case 'assigned':
      case 'unassigned':
        return (...args) => this.#syncIssueAssignees(...args);
      default:
        return undefined;
    }
  }

  async ingest(parsed: ParsedGithubWebhook): Promise<{ status: 'ignored' | 'committed' | 'replayed' | 'missing' }> {
    const event = eventName(parsed);
    const repository = object(parsed.payload.repository);
    const installationId = number(object(parsed.payload.installation)?.id);
    const repositoryId = number(repository?.id);
    const repositoryName = string(repository?.full_name);
    const login = string(object(parsed.payload.sender)?.login);
    if (parsed.event === 'push' && installationId && repositoryId) {
      await this.#handOffPush(parsed, installationId, repositoryId);
      return { status: 'ignored' };
    }
    if (!installationId || !repositoryId || !repositoryName || !login) return { status: 'ignored' };
    const issueAction = this.#issueActionHandler(parsed);
    const handle = event
      ? (project: ExternalRepositoryProjectTarget) =>
          this.#ingestProject(parsed, event, installationId, repositoryId, repositoryName, login, project)
      : issueAction
        ? (project: ExternalRepositoryProjectTarget) => issueAction(parsed, repositoryId, repositoryName, project)
        : undefined;
    if (!handle) return { status: 'ignored' };

    const projects = await this.options.sourceControl.projectRepositories.listByExternalRepository({
      installationExternalId: String(installationId),
      repositoryExternalId: String(repositoryId),
    });
    if (projects.length === 0) return { status: 'ignored' };
    const results = [];
    for (const project of projects) {
      results.push(await handle(project));
    }
    if (results.some(result => result.status === 'committed')) return { status: 'committed' };
    if (results.some(result => result.status === 'replayed')) return { status: 'replayed' };
    return results[0] ?? { status: 'ignored' };
  }

  /**
   * A push is not a work-item event; it only reaches the environment build
   * hand-off, once per project the repository is linked to. The hook decides
   * whether the project builds on push.
   */
  async #handOffPush(parsed: ParsedGithubWebhook, installationId: number, repositoryId: number): Promise<void> {
    const onRepositoryPush = this.options.onRepositoryPush;
    const ref = string(parsed.payload.ref);
    const defaultBranch = string(object(parsed.payload.repository)?.default_branch);
    if (!onRepositoryPush || !ref || !defaultBranch) return;
    const projects = await this.options.sourceControl.projectRepositories.listByExternalRepository({
      installationExternalId: String(installationId),
      repositoryExternalId: String(repositoryId),
    });
    for (const project of projects) {
      onRepositoryPush({
        orgId: project.orgId,
        factoryProjectId: project.factoryProjectId,
        projectRepository: {
          id: project.projectRepository.id,
          inEnvironment: project.projectRepository.inEnvironment,
        },
        ref,
        defaultBranch,
      });
    }
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
          ).find(
            subscription =>
              subscription.orgId === project.orgId && subscription.data?.factoryProjectId === project.factoryProjectId,
          )?.data,
          project.factoryProjectId,
        )
      : null;
    // Re-review events target the PR's own Review card, not the Work item that
    // provenance would otherwise bind the event to. For review_requested the
    // sender is whoever clicked re-request, so a Factory-authored PR must not
    // brand a human requester as factory-authored.
    const reviewRequested = event === 'pullRequestReviewRequested';
    const reviewCommand =
      event === 'pullRequestCommentCreated'
        ? parseFactoryReviewCommand(string(issueComment?.body), this.#factoryMentionTarget())
        : undefined;
    const reviewEntryRequested = reviewRequested || reviewCommand !== undefined;
    // Provenance proves the *pull request* came from Factory, which is not the
    // same as the sender of this event. For events where the sender is whoever
    // reacted to the PR — re-requesting review, commenting, submitting a review
    // — branding them from provenance would mark every human and every review
    // bot as Factory. Only the app login identifies Factory for those.
    const senderIsResponder =
      reviewRequested || event === 'pullRequestCommentCreated' || event === 'pullRequestReviewSubmitted';
    const reReviewEvent = reviewEntryRequested || event === 'pullRequestUpdated';
    const requestedReviewer = string(object(parsed.payload.requested_reviewer)?.login);
    const pullRequestAuthor = string(object(pullRequest?.user)?.login);
    const pullRequestFactoryAuthored = provenance !== null || this.#isFactoryLogin(pullRequestAuthor);
    const resolvedItem = await this.#relatedItem(
      project.orgId,
      project.factoryProjectId,
      repositoryId,
      repositoryName,
      issueNumber,
      pullRequestNumber,
      string(object(pullRequest?.head)?.ref),
      reReviewEvent ? null : provenance,
      senderIsResponder && !reviewEntryRequested,
    );
    const pullRequestLinkKey = pullRequestNumber
      ? githubPullRequestLinkKey(repositoryId, pullRequestNumber)
      : undefined;
    const pullRequestOpened = event === 'pullRequestOpened';
    // A pull request that says it fixes an issue Factory tracks belongs to that issue's card.
    const referencedItem =
      !resolvedItem && pullRequestOpened && string(pullRequest?.state) === 'open'
        ? await this.#referencedIssueItem(
            project.orgId,
            project.factoryProjectId,
            repositoryId,
            repositoryName,
            pullRequest,
          )
        : undefined;
    // Only a card on Work that isn't finished can take a pull request on; one that belongs to a
    // finished card (or one on another board) gets a card of its own, so it is still triaged.
    const candidateOwner = resolvedItem ?? referencedItem;
    const ownerItem =
      pullRequestOpened &&
      candidateOwner &&
      candidateOwner.externalSource?.type !== 'pull-request' &&
      !adoptsPullRequest(candidateOwner)
        ? undefined
        : candidateOwner;
    // A pull request that belongs to a card is linked to it, never filed as a card of its own.
    if (
      pullRequestOpened &&
      pullRequestLinkKey &&
      ownerItem &&
      ownerItem.externalSource?.type !== 'pull-request' &&
      string(pullRequest?.state) === 'open'
    ) {
      await this.options.storage.linkSource({
        orgId: project.orgId,
        factoryProjectId: project.factoryProjectId,
        workItemId: ownerItem.id,
        sourceKey: pullRequestLinkKey,
        kind: 'pull_request',
        integration: 'github',
        external: { repositoryId, number: pullRequestNumber, url: string(pullRequest?.html_url) ?? null },
        factoryAuthored: pullRequestFactoryAuthored,
      });
    }
    const pullRequestLink = pullRequestLinkKey
      ? await this.options.storage.findBySourceKey({
          orgId: project.orgId,
          factoryProjectId: project.factoryProjectId,
          sourceKey: pullRequestLinkKey,
        })
      : null;
    const linksPullRequest = (item: WorkItemRow | undefined) =>
      item !== undefined && item.externalSource?.type !== 'pull-request' && pullRequestLink?.workItemId === item.id;
    // A review-entry request must never treat a branch-matched authoring Work card as the pull
    // request's card unless that card links the pull request. A missing card is materialized below.
    const relatedItem =
      reviewEntryRequested && resolvedItem?.externalSource?.type !== 'pull-request' && !linksPullRequest(resolvedItem)
        ? undefined
        : ownerItem;
    const pullRequestLinked = linksPullRequest(relatedItem);
    // Set when this delivery makes the pull request the one the card has out (see `stampReviewRequested`).
    let pullRequestAdopted = false;
    const intake = issueNumber
      ? await this.#intakeTarget(project, repositoryName, labelNames(issue?.labels))
      : pullRequestNumber && pullRequest
        ? await this.#intakeTarget(project, repositoryName, labelNames(pullRequest.labels), {
            draft: pullRequest.draft === true,
            author: pullRequestAuthor,
          })
        : undefined;
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
      /** Set on the evaluation that files the pull request's own Review card. */
      pullRequestIntake = false,
      attempt = 1,
    ): Promise<{ status: 'ignored' | 'committed' | 'replayed' | 'missing' }> => {
      const context: FactoryGithubRuleContext = {
        tenant: { orgId: project.orgId, projectId: project.factoryProjectId },
        actor,
        ingress: { type: 'github', id: ingressIdentity },
        cause: `github.${event}`,
        causalChain: [],
        configVersion: this.options.configVersion,
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
                acceptedAt: item.acceptedAt,
                metadata: item.metadata,
              },
              board: boardForWorkItem(item),
              itemRevision: item.revision,
              ...withBoardClosure(this.options.boards, item),
              ...rulePhaseField(this.options.boards, item),
            }
          : {}),
        ...(intake ? { intake } : {}),
        ...(pullRequestIntake ? { pullRequestIntake: true } : {}),
        ...(item && pullRequestLinked && item.id === relatedItem?.id ? { pullRequestLinked: true } : {}),
        ...(item && pullRequestAdopted && item.id === relatedItem?.id ? { pullRequestAdopted: true } : {}),
        event,
        deliveryId: parsed.deliveryId,
        factory: { createdAt: factoryProject.createdAt.toISOString() },
        repository: { id: repositoryId, fullName: repositoryName, installationId },
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
                ...(pullRequestAuthor ? { author: pullRequestAuthor } : {}),
                factoryAuthored: pullRequestFactoryAuthored,
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
        ...(reviewCommand ? { reviewCommand } : {}),
        ...(object(parsed.payload.review)
          ? {
              review: {
                id: number(object(parsed.payload.review)?.id) ?? 0,
                state: string(object(parsed.payload.review)?.state) ?? 'unknown',
                url: string(object(parsed.payload.review)?.html_url) ?? '',
                ...(string(object(object(parsed.payload.review)?.user)?.login)
                  ? { author: string(object(object(parsed.payload.review)?.user)?.login) }
                  : {}),
                ...(string(object(parsed.payload.review)?.body)
                  ? { body: string(object(parsed.payload.review)?.body) }
                  : {}),
              },
            }
          : {}),
      };

      if (context.pullRequest && (event === 'pullRequestMerged' || event === 'pullRequestClosed')) {
        await this.options.storage.updateSourceState({
          orgId: project.orgId,
          factoryProjectId: project.factoryProjectId,
          sourceKey: githubPullRequestLinkKey(context.repository.id, context.pullRequest.number),
          state: event === 'pullRequestMerged' ? 'merged' : 'closed',
        });
      }
      const rule = selectEventRule(
        this.options.github.rules,
        boardEventHandlers(this.options.boards, eventBoardId(context), 'github'),
        event,
      );
      let decision: FactoryRuleDecision | void;
      let decisions: Record<string, unknown>[] = [];
      let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
      try {
        decision = rule ? await withRuleTimeout(Promise.resolve(rule(Object.freeze(context)))) : undefined;
        if (decision?.type === 'reject') {
          outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
        } else if (decision) {
          decisions = validateFactoryRuleDecisions([decision]).map(entry => {
            assertFactoryDecisionTarget(entry, this.options.boards, item ? boardForWorkItem(item) : undefined);
            return { ...entry };
          });
        }
        decisions = await this.#routeEventMoves(project, event, item, context, decisions);
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
        configVersion: this.options.configVersion,
        expectedRevision: item?.revision ?? null,
        actor: { ...actor },
        outcome,
        decisions,
        causalChain: [],
        now: new Date(),
      });
      if (committed.status === 'stale') {
        // The item was written concurrently. Re-read it and run the rule again
        // against the fresh revision; nothing was persisted for this attempt.
        if (attempt >= MAX_STALE_RULE_ATTEMPTS) {
          throw new Error(`Factory GitHub rule evaluation for ${ingressIdentity} kept losing revision races.`);
        }
        const fresh = item ? await this.options.storage.get({ orgId: project.orgId, id: item.id }) : null;
        if (item && !fresh) return { status: 'missing' };
        return evaluate(fresh ?? undefined, ingressIdentity, pullRequestIntake, attempt + 1);
      }
      return { status: committed.status };
    };

    // A push moves the head a recorded review verdict was given on. Recording
    // the new head lets the verdict badge show that it is outdated, while the
    // verdict itself stays so the next pass still runs as a re-review. It is
    // recorded before the push is evaluated: the dispatcher can apply the
    // re-review transition as soon as it commits, and the pass it starts names
    // the head it covers, which must be the pushed one.
    const stampHead = async () => {
      const headSha = string(object(pullRequest?.head)?.sha)?.toLowerCase();
      if (event !== 'pullRequestUpdated' || !headSha || !pullRequestNumber) return;
      const headAt = timestamp(pullRequest?.updated_at);
      if (pullRequestLinked && relatedItem) {
        await recordPullRequestHead(this.options.storage, {
          orgId: relatedItem.orgId,
          id: relatedItem.id,
          headSha,
          headAt,
          ownedPullRequestNumber: pullRequestNumber,
        });
        return;
      }
      if (relatedItem?.externalSource?.type !== 'pull-request') return;
      const parent = await this.#linkedClosureItem(
        project.orgId,
        project.factoryProjectId,
        repositoryId,
        repositoryName,
        pullRequestNumber,
        relatedItem,
      );
      // The authoring Work item mirrors the verdict of the pull request it has
      // out; a push to an older one must not mark its successor's verdict.
      await recordPullRequestHead(this.options.storage, {
        orgId: relatedItem.orgId,
        id: relatedItem.id,
        headSha,
        headAt,
      });
      if (parent) {
        await recordPullRequestHead(this.options.storage, {
          orgId: parent.orgId,
          id: parent.id,
          headSha,
          headAt,
          ownedPullRequestNumber: pullRequestNumber,
        });
      }
    };
    await stampHead();
    let evaluated =
      event === 'pullRequestUpdated' && relatedItem
        ? ((await this.options.storage.get({ orgId: relatedItem.orgId, id: relatedItem.id })) ?? relatedItem)
        : relatedItem;
    const deliveryIdentity = `${installationId}:${parsed.deliveryId}`;
    // A pull request opening concerns two cards: its own Review card, which the
    // arrival rule files — committed against the Work item that authored the
    // pull request when one exists, because that binding is what links the two
    // — and that authoring item, which is now out for review. The arrival is
    // the delivery's own evaluation; the item's is a second one, under an
    // identity suffixed with its id, because ingress identities are the replay
    // key and reusing the delivery's own would drop it as a duplicate.
    const authoringItem =
      pullRequestOpened && relatedItem !== undefined && relatedItem.externalSource?.type !== 'pull-request'
        ? relatedItem
        : undefined;
    // The card records which pull request it has out, so an agent cannot close the work while it is
    // still open and Review's runner reviews it. Mirrors the out-for-review rule's gates (trusted or
    // Factory's own; adoption was checked when linking). The link records whether the pull request is
    // still open, so a redelivery after the close cannot mark the card again.
    const stampOpened = async () => {
      if (!pullRequestNumber || !pullRequestOpened || !authoringItem || !pullRequestLinkKey) return false;
      const trusted = (actor.type === 'github' && actor.trusted) || pullRequestFactoryAuthored;
      if (!trusted) return false;
      const link = await this.options.storage.findBySourceKey({
        orgId: project.orgId,
        factoryProjectId: project.factoryProjectId,
        sourceKey: pullRequestLinkKey,
      });
      if (link?.workItemId !== authoringItem.id || link.state !== 'open') return false;
      // The head comes along so a head recorded for an earlier pull request cannot mark this one's
      // verdict outdated. A replayed opening of the pull request already recorded keeps the head its
      // pushes left.
      const rebinding = authoringItem.metadata?.openPullRequestNumber !== pullRequestNumber;
      await this.options.storage.update({
        orgId: authoringItem.orgId,
        id: authoringItem.id,
        userId: 'factory-rule-dispatcher',
        patch: {
          metadata: {
            openPullRequestNumber: pullRequestNumber,
            openPullRequestUrl: string(pullRequest?.html_url) ?? null,
            openPullRequestFactoryAuthored: pullRequestFactoryAuthored,
            ...(rebinding
              ? {
                  pullRequestHeadSha: string(object(pullRequest?.head)?.sha)?.toLowerCase() ?? null,
                  pullRequestHeadAt: timestamp(pullRequest?.updated_at) ?? null,
                }
              : {}),
          },
        },
      });
      return true;
    };
    // A maintainer asking Factory to review a pull request linked to a card (one an outsider opened
    // against its issue, say) makes it the pull request that card has out.
    const stampReviewRequested = async () => {
      if (!reviewEntryRequested || !pullRequestLinked || !relatedItem || !pullRequestNumber) return false;
      if (actor.type !== 'github' || !actor.trusted || actor.factoryAuthored) return false;
      if (string(pullRequest?.state) !== 'open' || pullRequest?.merged === true) return false;
      if (relatedItem.metadata?.openPullRequestNumber === pullRequestNumber || !adoptsPullRequest(relatedItem))
        return false;
      await this.options.storage.update({
        orgId: relatedItem.orgId,
        id: relatedItem.id,
        userId: 'factory-rule-dispatcher',
        patch: {
          metadata: {
            openPullRequestNumber: pullRequestNumber,
            openPullRequestUrl: string(pullRequest?.html_url) ?? null,
            openPullRequestFactoryAuthored: pullRequestFactoryAuthored,
            pullRequestHeadSha: string(object(pullRequest?.head)?.sha)?.toLowerCase() ?? null,
            pullRequestHeadAt: timestamp(pullRequest?.updated_at) ?? null,
          },
        },
      });
      return true;
    };
    // The card records which pull request it has out before its rule runs: the dispatcher can apply
    // the move to Review as soon as it commits, and Review's runner reviews the recorded pull request.
    pullRequestAdopted = await stampReviewRequested();
    const stamped = (await stampOpened()) || pullRequestAdopted;
    if (stamped && relatedItem) {
      evaluated = (await this.options.storage.get({ orgId: relatedItem.orgId, id: relatedItem.id })) ?? relatedItem;
    }
    const primary = await evaluate(evaluated, deliveryIdentity, pullRequestOpened && authoringItem === undefined);
    // A closed pull request is the one *other* event both linked cards need:
    // the Review card has to close, and the Work item that wrote the code has
    // to finish (on merge) or at least stop recording it as open. Resolution binds the delivery to
    // whichever card it matched first, so evaluate the other one too.
    const linked =
      (event === 'pullRequestMerged' || event === 'pullRequestClosed') && relatedItem && pullRequestNumber
        ? await this.#linkedClosureItem(
            project.orgId,
            project.factoryProjectId,
            repositoryId,
            repositoryName,
            pullRequestNumber,
            relatedItem,
          )
        : undefined;
    // Moving the card to Done does not touch its pull request fields, so without
    // this the card reads "open" until the next sweep and still offers Re-review.
    // Stamped after the evaluations, which commit at the revision they read. (Openings and review
    // requests stamp first instead: see `stampOpened`.)
    const stampClosed = async () => {
      if (!pullRequestNumber) return;
      if (event !== 'pullRequestMerged' && event !== 'pullRequestClosed') return;
      for (const card of [relatedItem, linked]) {
        if (!card) continue;
        if (card.externalSource?.type !== 'pull-request') {
          // A merge settles the review, so the authoring Work item's mirrored
          // "request changes" no longer stops it from being closed.
          // Only the pull request the card has out settles it; an older one
          // merging must not clear a verdict that belongs to its successor.
          const recorded = card.metadata?.openPullRequestNumber;
          const ownsCard =
            recorded === pullRequestNumber ||
            (typeof recorded !== 'number' && (!pullRequestLinked || pullRequestFactoryAuthored));
          const settled = {
            ...(ownsCard && event === 'pullRequestMerged' && typeof card.metadata?.reviewVerdict === 'string'
              ? { reviewVerdict: null }
              : {}),
            ...(recorded === pullRequestNumber
              ? { openPullRequestNumber: null, openPullRequestUrl: null, openPullRequestFactoryAuthored: null }
              : {}),
          };
          if (Object.keys(settled).length > 0) {
            await this.options.storage.update({
              orgId: card.orgId,
              id: card.id,
              userId: 'factory-rule-dispatcher',
              patch: { metadata: settled },
            });
          }
          continue;
        }
        await this.options.storage.update({
          orgId: card.orgId,
          id: card.id,
          userId: 'factory-rule-dispatcher',
          patch: { metadata: { state: 'closed', merged: event === 'pullRequestMerged' } },
        });
      }
    };
    if (linked === undefined) {
      await stampClosed();
      return primary;
    }
    const secondary = await evaluate(linked, `${deliveryIdentity}:${linked.id}`);
    await stampClosed();
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
    const items = unfolded(await this.options.storage.list({ orgId, factoryProjectId: projectId }));
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

  /**
   * The issue card a newly opened pull request says it closes ("fixes #12", "closes acme/repo#12" or
   * the issue's URL), in the same repository. The first referenced issue with a card wins.
   */
  async #referencedIssueItem(
    orgId: string,
    projectId: string,
    repositoryId: number,
    repositoryFullName: string,
    pullRequest: Record<string, unknown> | undefined,
  ): Promise<WorkItemRow | undefined> {
    const numbers = closingIssueNumbers(string(pullRequest?.body), repositoryFullName);
    if (numbers.length === 0) return undefined;
    const items = unfolded(await this.options.storage.list({ orgId, factoryProjectId: projectId }));
    for (const issueNumber of numbers) {
      const item = this.#resolveItem(items, repositoryId, repositoryFullName, issueNumber, undefined, undefined, null);
      if (item) return item;
    }
    return undefined;
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
    const items = unfolded(await this.options.storage.list({ orgId, factoryProjectId: projectId }));
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
    if (resolved || !pullRequestNumber) return resolved;
    // No card of its own: the pull request belongs to the card that links it.
    const link = await this.options.storage.findBySourceKey({
      orgId,
      factoryProjectId: projectId,
      sourceKey: githubPullRequestLinkKey(repositoryId, pullRequestNumber),
    });
    return link ? items.find(item => item.id === link.workItemId) : undefined;
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

export interface PolledPullRequestState extends ReconcilePullRequestState {
  createdAt: string;
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

/** Lists a repository's open issues (pull requests excluded) for missed-open discovery. */
export type GithubOpenIssueLister = (input: {
  installationId: number;
  repository: string;
}) => Promise<Array<ReconcileIssueState & { number: number }>>;

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

/** Whether a card can take a pull request on: a non-pull-request card on Work that isn't finished. */
export function adoptsPullRequest(item: WorkItemRow): boolean {
  return (
    item.externalSource?.type !== 'pull-request' &&
    boardForWorkItem(item) === 'work' &&
    !isTerminalFactoryRuleStage(item.stages) &&
    typeof item.metadata?.foldedInto !== 'string'
  );
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
        assignees: githubUsers(state.assignees),
      },
    },
  };
}

/**
 * The label-drift replay: an open issue whose labels changed without a
 * `labeled`/`unlabeled` webhook ever arriving (Factory was down, the delivery
 * was lost, or the label was applied by something other than a delivery the
 * webhook saw). Synthesized as an `opened` delivery so the deployment's
 * `issueOpened` rule decides placement, exactly as it does at arrival — one
 * source of placement policy for both.
 */
export function reconciledIssueRelabeledEvent(
  repository: ReconcileRepository,
  issueNumber: number,
  state: ReconcileIssueState,
): ParsedGithubWebhook {
  const labels = state.labels ?? [];
  // GitHub updates `updated_at` for a label change. Including it makes retries
  // of one observed issue version idempotent while allowing A → B → A to replay
  // its final A placement as a new version. Synthetic callers without it retain
  // the legacy label-only identity.
  const digest = createHash('sha256')
    .update([...labels].sort().join('\n'))
    .digest('hex')
    .slice(0, 16);
  const version = state.updatedAt ? `:${createHash('sha256').update(state.updatedAt).digest('hex').slice(0, 16)}` : '';
  return {
    event: 'issues',
    deliveryId: `reconcile:${repository.id}:issue:${issueNumber}:relabeled:${digest}${version}`,
    payload: {
      // `opened` is the event that carries an issue's labels through the rules;
      // an already-filed card is re-placed by the decision, not re-materialized.
      action: 'opened',
      installation: { id: repository.installationId },
      repository: { id: repository.id, full_name: repository.fullName },
      sender: { login: state.author ?? 'github' },
      issue: {
        number: issueNumber,
        title: state.title,
        html_url: state.url,
        state: 'open',
        ...(state.createdAt ? { created_at: state.createdAt } : {}),
        ...(state.updatedAt ? { updated_at: state.updatedAt } : {}),
        assignees: githubUsers(state.assignees),
        labels: githubLabels(labels),
      },
    },
  };
}

/**
 * The missed-open replay: an open issue with no Work card, because its
 * `opened` delivery never reached the rules ingress. Synthesized as the same
 * `opened` delivery so the deployment's `issueOpened` rule decides whether and
 * where it lands, exactly as it would have at arrival. The delivery id is
 * stable per issue so repeat sweeps dedupe at the ingress.
 */
export function reconciledIssueOpenedEvent(
  repository: ReconcileRepository,
  issueNumber: number,
  state: ReconcileIssueState,
): ParsedGithubWebhook {
  const event = reconciledIssueRelabeledEvent(repository, issueNumber, state);
  return { ...event, deliveryId: `reconcile:${repository.id}:issue:${issueNumber}:opened` };
}

export function polledPullRequestEvent(
  repository: ReconcileRepository,
  pullRequestNumber: number,
  state: PolledPullRequestState,
): ParsedGithubWebhook {
  return {
    event: 'pull_request',
    deliveryId: `poll:${repository.id}:pull-request:${pullRequestNumber}:${state.createdAt}`,
    payload: {
      action: 'opened',
      installation: { id: repository.installationId },
      repository: { id: repository.id, full_name: repository.fullName },
      sender: { login: state.author ?? '__unknown__' },
      pull_request: pullRequestPayload(pullRequestNumber, state),
    },
  };
}

export function reconciledClosedEvent(
  repository: ReconcileRepository,
  pullRequestNumber: number,
  state: ReconcilePullRequestState,
): ParsedGithubWebhook {
  const outcome = state.merged ? 'merged' : 'closed';
  return {
    event: 'pull_request',
    // Stable per (repository, PR, outcome): the ingress dedupe makes repeat
    // reconcile cycles replay instead of re-committing decisions.
    deliveryId: `reconcile:${repository.id}:pull-request:${pullRequestNumber}:${outcome}`,
    payload: {
      action: 'closed',
      installation: { id: repository.installationId },
      repository: { id: repository.id, full_name: repository.fullName },
      sender: { login: state.mergedBy ?? 'github' },
      pull_request: pullRequestPayload(pullRequestNumber, { ...state, state: 'closed' }),
    },
  };
}

function pullRequestPayload(pullRequestNumber: number, state: ReconcilePullRequestState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    number: pullRequestNumber,
    title: state.title,
    html_url: state.url,
    state: state.state,
    draft: state.draft,
    merged: state.merged,
    assignees: githubUsers(state.assignees),
    requested_reviewers: githubUsers(state.requestedReviewers),
    labels: githubLabels(state.labels),
    head: { ref: state.headBranch },
    base: { ref: state.baseBranch },
  };
  if (state.createdAt) payload.created_at = state.createdAt;
  if (state.author) payload.user = { login: state.author };
  return payload;
}

function githubUsers(logins: readonly string[] = []): Array<{ login: string }> {
  return logins.map(login => ({ login }));
}

function githubLabels(names: readonly string[] = []): Array<{ name: string }> {
  return names.map(name => ({ name }));
}

function reconciledPullRequestMetadata(
  state: ReconcilePullRequestState,
  reconciliation: 'clear' | 'settled',
  authorTrusted?: boolean,
): Record<string, unknown> {
  return {
    state: state.state,
    draft: state.draft,
    merged: state.merged,
    ...(state.author ? { author: state.author } : {}),
    ...(state.assignees ? { assignees: state.assignees } : {}),
    ...(state.requestedReviewers ? { requestedReviewers: state.requestedReviewers } : {}),
    ...(state.labels ? { labels: state.labels } : {}),
    ...(authorTrusted === undefined ? {} : { authorTrusted }),
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
      let unanswered: Array<{ item: WorkItemRow; author: string }>;
      try {
        const projects = await options.sourceControl.projectRepositories.listByExternalRepository({
          installationExternalId: String(repository.installationId),
          repositoryExternalId: String(repository.id),
        });
        if (projects.length === 0) continue;
        cardsByNumber = new Map<number, WorkItemRow[]>();
        unanswered = [];
        for (const project of projects) {
          const items = await options.storage.list({
            orgId: project.orgId,
            factoryProjectId: project.factoryProjectId,
          });
          for (const item of items) {
            const unansweredAuthor = authorAwaitingTrust(item, repository);
            if (unansweredAuthor) unanswered.push({ item, author: unansweredAuthor });
            const pullRequestNumber = reconcilablePullRequestNumber(item, repository);
            if (!pullRequestNumber) {
              // A card that took a pull request on has no card for it, so the sweep checks the one it has
              // out: a missed merge or close is replayed and resolves to the card through its link.
              const owned = item.metadata?.openPullRequestNumber;
              if (typeof owned !== 'number' || typeof item.metadata?.foldedInto === 'string') continue;
              const link = await options.storage.findBySourceKey({
                orgId: project.orgId,
                factoryProjectId: project.factoryProjectId,
                sourceKey: githubPullRequestLinkKey(repository.id, owned),
              });
              if (link?.workItemId === item.id && !cardsByNumber.has(owned)) cardsByNumber.set(owned, []);
              continue;
            }
            const metadata = item.metadata ?? {};
            const reconciliation = metadata[FACTORY_PULL_REQUEST_RECONCILIATION_KEY];
            const reconciledOutcome = reconciledPullRequestOutcome(metadata);
            if (
              workItemPhaseSemantics(options.boards, item)?.kind === 'terminal' &&
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
      const authorTrust = sweepTrustLookup(options.github, repository);
      for (const { item, author } of unanswered) {
        try {
          await options.storage.update({
            orgId: item.orgId,
            id: item.id,
            userId: 'factory-rule-dispatcher',
            patch: { metadata: { authorTrusted: await authorTrust(author) } },
          });
        } catch (error) {
          recordFailure(repository, error);
        }
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
          // Re-stamped on every sweep so revoked write access reads untrusted
          // within one cycle; a failed lookup keeps the last stamp and retries.
          let authorTrusted: boolean | undefined;
          if (state.author !== undefined) {
            try {
              authorTrusted = await authorTrust(state.author);
            } catch (error) {
              recordFailure(repository, error, pullRequestNumber);
            }
          }
          for (const card of cards) {
            if (state.state === 'closed') continue;
            const metadata = card.metadata ?? {};
            const statusChanged =
              metadata.state !== state.state || metadata.draft !== state.draft || metadata.merged !== state.merged;
            const authorChanged = state.author !== undefined && metadata.author !== state.author;
            const assigneesChanged = !sameStrings(metadata.assignees, state.assignees);
            const reviewersChanged = !sameStrings(metadata.requestedReviewers, state.requestedReviewers);
            const labelsChanged = !sameStrings(metadata.labels, state.labels);
            const trustStale = authorTrusted !== undefined && metadata.authorTrusted !== authorTrusted;
            const metadataChanged =
              statusChanged || authorChanged || assigneesChanged || reviewersChanged || labelsChanged || trustStale;
            const reconciliation = metadata[FACTORY_PULL_REQUEST_RECONCILIATION_KEY];
            if (!metadataChanged && reconciliation !== 'merged' && reconciliation !== 'closed') continue;
            try {
              await options.storage.update({
                orgId: card.orgId,
                id: card.id,
                userId: 'factory-rule-dispatcher',
                patch: {
                  metadata: reconciledPullRequestMetadata(state, 'clear', trustStale ? authorTrusted : undefined),
                },
              });
            } catch (error) {
              recordFailure(repository, error, pullRequestNumber);
            }
          }
          if (state.state !== 'closed') continue;
          const cleanupFailures = new Set<string>();
          for (const card of cards) {
            if (workItemPhaseSemantics(options.boards, card)?.kind !== 'terminal') continue;
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
            const trustStale = authorTrusted !== undefined && (card.metadata ?? {}).authorTrusted !== authorTrusted;
            try {
              await options.storage.update({
                orgId: card.orgId,
                id: card.id,
                userId: 'factory-rule-dispatcher',
                patch: {
                  metadata: reconciledPullRequestMetadata(state, 'settled', trustStale ? authorTrusted : undefined),
                },
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
  if (!context.runtime) return undefined;
  return {
    github,
    sourceControl: context.storage.sourceControl,
    integrationStorage: context.storage.generic,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
    ...(context.runtime.boardResolver ? { boardResolver: context.runtime.boardResolver } : {}),
    intake: context.storage.intake,
    ...(context.hooks?.onRepositoryPush ? { onRepositoryPush: context.hooks.onRepositoryPush } : {}),
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
