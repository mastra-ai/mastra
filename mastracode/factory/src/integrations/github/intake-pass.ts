import type { Intake, IntakeIssue } from '../../capabilities/intake.js';
import type { PullRequest, VersionControl } from '../../capabilities/version-control.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { Card } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import {
  createIntakePass,
  linkedIntakeRepositories,
  listSourcesInTurn,
  offerEach,
  runIntakePasses,
} from '../intake-pass.js';
import type {
  CandidateStore,
  IntakePass,
  IntakePassStatusStore,
  LinkedIntakeRepository,
  OrgIntakeListing,
} from '../intake-pass.js';
import { githubIssueRecord, githubIssueRepositories, githubPullRequestRecord } from './intake-candidates.js';
import type { GithubIssueSelection } from './intake-candidates.js';
import type { GithubIssueReconciler } from './issue-reconciler.js';
import {
  GithubRules,
  githubRulesOptions,
  listedPullRequestState,
  polledPullRequestEvent,
  reconciledIssueOpenedEvent,
} from './rules.js';
import type { GithubPullRequestDiscovery, GithubRulesIntegration, ReconcileRepository } from './rules.js';
import type { ParsedGithubWebhook } from './webhook.js';

interface Listed<T> {
  repository: LinkedIntakeRepository;
  item: T;
}

export interface GithubIntakeLister {
  intake: Pick<Intake, 'listIssues'>;
  versionControl: Pick<VersionControl, 'listPullRequests'>;
}

export interface GithubIntakePassOptions {
  github: GithubIntakeLister;
  sourceControl: Pick<SourceControlStorageHandle, 'connections'>;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  storage: CandidateStore;
  status: IntakePassStatusStore;
  /** The issue sources picked in Settings › Intake; without it every linked repository is one. */
  intake?: GithubIssueSelection;
  ingest(event: ParsedGithubWebhook): Promise<unknown>;
}

function repositoryOf(repository: LinkedIntakeRepository): ReconcileRepository {
  return {
    id: Number(repository.externalId),
    fullName: repository.slug,
    installationId: Number(repository.installationExternalId),
  };
}

/** A card filed before keys named the repository is still found by the record's address. */
const cardKeys = (card: Card) => (card.externalSource?.url ? [`url:${card.externalSource.url}`] : []);

/**
 * The passes that keep the GitHub candidates of every project: one over the open issues of its
 * linked repositories and one over their open pull requests. Linking a repository imports its
 * newest records itself, so a pass only hands the rules what was created after the link.
 */
export function createGithubIntakePasses(options: GithubIntakePassOptions): IntakePass[] {
  const { github } = options;
  const shared = {
    integrationId: 'github',
    projects: options.projects,
    storage: options.storage,
    status: options.status,
    importsAtBind: false,
    cardKeys,
  };
  const open =
    <T>(
      list: (
        repository: LinkedIntakeRepository,
        cursor: string | undefined,
      ) => Promise<{ items: T[]; nextCursor: string | null }>,
      taken: (orgId: string) => Promise<(slug: string) => boolean> = async () => () => true,
    ) =>
    async (orgId: string, factoryProjectIds: string[]): Promise<OrgIntakeListing<Listed<T>>> => {
      const [every, takes] = await Promise.all([
        linkedIntakeRepositories(options.sourceControl, orgId, factoryProjectIds),
        taken(orgId),
      ]);
      const linked = new Map(
        [...every].map(([projectId, repositories]) => [
          projectId,
          repositories.filter(repository => takes(repository.slug)),
        ]),
      );
      return {
        sources: factoryProjectId =>
          new Map((linked.get(factoryProjectId) ?? []).map(repository => [repository.id, repository.linkedAt])),
        list: (factoryProjectId, sourceIds, cursor) =>
          listSourcesInTurn(
            (linked.get(factoryProjectId) ?? []).filter(repository => sourceIds.includes(repository.id)),
            cursor,
            async (repository, inner) => {
              const page = await list(repository, inner);
              return { items: page.items.map(item => ({ repository, item })), nextCursor: page.nextCursor };
            },
          ),
      };
    };
  const connectionOf = (repository: LinkedIntakeRepository) => ({
    type: 'app-installation' as const,
    installationId: Number(repository.installationExternalId),
  });

  return [
    createIntakePass<Listed<IntakeIssue>>({
      ...shared,
      kind: 'issue',
      open: open(
        async (repository, cursor) => {
          const page = await github.intake.listIssues({
            connection: connectionOf(repository),
            sourceIds: [repository.slug],
            ...(cursor ? { cursor } : {}),
          });
          return { items: page.issues, nextCursor: page.nextCursor };
        },
        orgId => githubIssueRepositories(options.intake, orgId),
      ),
      record: ({ repository, item }) =>
        githubIssueRecord(Number(repository.externalId), {
          number: Number(item.id),
          title: item.title,
          url: item.url,
          author: item.author,
          assignees: item.assignees ?? (item.assignee ? [item.assignee] : []),
          labels: item.labels,
          createdAt: item.createdAt,
        }),
      sourceId: ({ repository }) => repository.id,
      itemKeys: ({ item }) => [`url:${item.url}`],
      offer: (_project, issues) =>
        offerEach(issues, ({ repository, item }) =>
          options.ingest(
            reconciledIssueOpenedEvent(repositoryOf(repository), Number(item.id), {
              title: item.title,
              url: item.url,
              state: 'open',
              assignees: item.assignees ?? [],
              labels: item.labels,
              ...(item.author ? { author: item.author } : {}),
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            }),
          ),
        ),
    }),
    createIntakePass<Listed<PullRequest>>({
      ...shared,
      kind: 'pull-request',
      open: open(async (repository, cursor) => {
        const page = await github.versionControl.listPullRequests({
          connection: connectionOf(repository),
          sourceId: repository.slug,
          includeDrafts: false,
          ...(cursor ? { cursor } : {}),
        });
        return { items: page.pullRequests, nextCursor: page.nextCursor };
      }),
      record: ({ repository, item }) =>
        githubPullRequestRecord(Number(repository.externalId), {
          number: Number(item.id),
          title: item.title,
          url: item.url,
          author: item.author ?? null,
          assignees: item.assignees ?? [],
          labels: item.labels ?? [],
          createdAt: item.createdAt,
          requestedReviewers: item.requestedReviewers ?? [],
          headBranch: item.headBranch,
          baseBranch: item.baseBranch,
        }),
      sourceId: ({ repository }) => repository.id,
      itemKeys: ({ item }) => [`url:${item.url}`],
      offer: (_project, pullRequests) =>
        offerEach(pullRequests, ({ repository, item }) => {
          const state = listedPullRequestState(item);
          return options.ingest(polledPullRequestEvent(repositoryOf(repository), state.number, state));
        }),
    }),
  ];
}

/** The GitHub passes of a mounted integration; none until the rules runtime is there. */
export function attachGithubIntakePasses(
  github: GithubRulesIntegration & GithubIntakeLister,
  context: IntegrationContext,
): IntakePass[] {
  const options = githubRulesOptions(github, context);
  if (!options) return [];
  // The rules are called directly: the pass stores what they leave, so the event path need not.
  const rules = new GithubRules(options);
  return createGithubIntakePasses({
    github,
    sourceControl: options.sourceControl,
    projects: options.projects,
    storage: options.storage,
    status: options.integrationStorage.settings,
    ...(options.intake ? { intake: options.intake } : {}),
    ingest: event => rules.ingest(event),
  });
}

/**
 * Run the passes of the projects whose sources changed after pull-request discovery, under its
 * lease and on its timer. That is what brings a selection saved in Settings › Intake into effect:
 * the save itself asks GitHub for nothing, and the hourly pass is too far away to wait for.
 */
export function withChangedGithubIntakeSources(
  discover: GithubPullRequestDiscovery | undefined,
  passes: readonly IntakePass[],
): GithubPullRequestDiscovery | undefined {
  if (!discover || passes.length === 0) return discover;
  return async repositories => {
    const found = await discover(repositories);
    const intake = await runIntakePasses(passes, { changedSources: true });
    return {
      ...found,
      failed: found.failed + intake.failed,
      errors: [...found.errors, ...intake.errors.map(error => ({ repository: error.projectId, error: error.error }))],
    };
  };
}

/** Run the intake passes after the issue sweep, under its lease and on its timer. */
export function withGithubIntakePasses(
  reconcile: GithubIssueReconciler | undefined,
  passes: readonly IntakePass[],
): GithubIssueReconciler | undefined {
  if (!reconcile || passes.length === 0) return reconcile;
  return async repositories => {
    const swept = await reconcile(repositories);
    const intake = await runIntakePasses(passes);
    return {
      ...swept,
      failed: swept.failed + intake.failed,
      errors: [...swept.errors, ...intake.errors.map(error => ({ repository: error.projectId, error: error.error }))],
    };
  };
}
