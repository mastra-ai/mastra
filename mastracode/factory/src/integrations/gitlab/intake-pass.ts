import { pullRequestSources } from '../../boards/semantics.js';
import type { IntakeIssue } from '../../capabilities/intake.js';
import type { PullRequest } from '../../capabilities/version-control.js';
import type { Card, ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import {
  boundIntakeSources,
  createIntakePass,
  linkedIntakeRepositories,
  listSourcesInTurn,
  offerEach,
} from '../intake-pass.js';
import type { IntakePass, IntakeRecord, LinkedIntakeRepository } from '../intake-pass.js';
import { mergeRequestSourceKey } from './intake-candidates.js';
import { decodeSourceId, encodeIssueReference } from './integration.js';
import type { GitLabIntegrationBase } from './integration.js';
import { listedIssueEvent, listedMergeRequestEvents } from './routes.js';
import { GitLabRules } from './rules.js';
import type { ParsedGitLabWebhook } from './webhook.js';

/** GitLab reads a source with the credentials it resolves from the source id, not with these. */
const SOURCE_CONNECTION = { type: 'oauth', accessToken: 'gitlab-route' } as const;

function createdAt(value: string): Date | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

function issueSource(issue: IntakeIssue): ExternalWorkItemSource | null {
  const source = decodeSourceId(issue.sourceId ?? '');
  const issueIid = Number(issue.id);
  if (!source || !Number.isSafeInteger(issueIid) || issueIid <= 0) return null;
  return {
    integrationId: 'gitlab',
    type: 'issue',
    externalId: encodeIssueReference({ ...source, issueIid }),
    url: issue.url,
  };
}

/** A GitLab issue as the Intake column offers it; `null` for one GitLab did not address properly. */
export function gitlabIssueRecord(issue: IntakeIssue): IntakeRecord | null {
  const source = issueSource(issue);
  if (!source) return null;
  return {
    source,
    title: issue.title,
    metadata: {
      gitlabIssueId: issue.id,
      identifier: issue.identifier,
      state: issue.state,
      stateType: issue.stateType,
      assignee: issue.assignee,
      assignees: issue.assignees ?? [],
      author: issue.author,
      sourceId: issue.sourceId,
      labels: issue.labels,
      labelColors: issue.labelColors ?? {},
      sourceCreatedAt: issue.createdAt,
    },
    createdAt: createdAt(issue.createdAt),
  };
}

interface ListedMergeRequest {
  repository: LinkedIntakeRepository;
  project: { host: string; projectId: number; projectPath: string };
  mergeRequest: PullRequest;
}

export function gitlabMergeRequestRecord({
  project,
  mergeRequest,
}: Omit<ListedMergeRequest, 'repository'>): IntakeRecord {
  const iid = Number(mergeRequest.id);
  return {
    source: {
      integrationId: 'gitlab',
      type: 'pull-request',
      externalId: mergeRequestSourceKey(project.host, project.projectId, iid),
      url: mergeRequest.url,
    },
    title: mergeRequest.title,
    metadata: {
      gitlabMergeRequestIid: iid,
      author: mergeRequest.author ?? null,
      assignees: mergeRequest.assignees ?? [],
      requestedReviewers: mergeRequest.requestedReviewers ?? [],
      labels: mergeRequest.labels ?? [],
      headBranch: mergeRequest.headBranch,
      baseBranch: mergeRequest.baseBranch,
      sourceCreatedAt: mergeRequest.createdAt,
    },
    createdAt: createdAt(mergeRequest.createdAt),
  };
}

/** A merge request attached to an issue's card is held under this id, not under its own. */
const attachedKey = (externalId: string) => `pull-request:${externalId}`;
const attachedKeys = (card: Card) =>
  pullRequestSources(card).flatMap(source => (source.integrationId === 'gitlab' ? [source.externalId] : []));

/**
 * The passes that keep a project's GitLab candidates: the open issues of the sources bound to it
 * and the open merge requests of the repositories linked to it. Both run in the mounted
 * integration's five-minute sweep.
 */
export function attachGitLabIntakePasses(gitlab: GitLabIntegrationBase, context: IntegrationContext): IntakePass[] {
  if (!context.runtime) return [];
  const rules = new GitLabRules({
    gitlab,
    sourceControl: context.storage.sourceControl,
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    intake: context.storage.intake,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
  });
  const ingest = (events: Array<ParsedGitLabWebhook | null>) =>
    offerEach(
      events.filter(event => event !== null),
      event => rules.ingest(event),
    );
  const shared = {
    integrationId: 'gitlab',
    projects: context.storage.projects,
    storage: context.runtime.workItems,
    status: context.storage.generic.settings,
  };

  return [
    createIntakePass<IntakeIssue>({
      ...shared,
      kind: 'issue',
      // A source bound without a linked repository gets no import when it is bound.
      importsAtBind: true,
      open: async orgId => {
        const bound = await boundIntakeSources(context.storage.intake, orgId, 'gitlab');
        return {
          sources: factoryProjectId => bound.forProject(factoryProjectId),
          list: async (_factoryProjectId, sourceIds, cursor) => {
            const page = await gitlab.intake.listIssues({
              connection: SOURCE_CONNECTION,
              sourceIds,
              ...(cursor ? { cursor } : {}),
            });
            return { items: page.issues.filter(issue => issueSource(issue) !== null), nextCursor: page.nextCursor };
          },
        };
      },
      record: issue => gitlabIssueRecord(issue)!,
      sourceId: issue => issue.sourceId,
      offer: (_project, issues) => ingest(issues.map(listedIssueEvent)),
    }),
    createIntakePass<ListedMergeRequest>({
      ...shared,
      kind: 'pull-request',
      importsAtBind: false,
      open: async (orgId, factoryProjectIds) => {
        const linked = await linkedIntakeRepositories(context.storage.sourceControl, orgId, factoryProjectIds);
        return {
          sources: factoryProjectId =>
            new Map((linked.get(factoryProjectId) ?? []).map(repository => [repository.id, repository.linkedAt])),
          list: (factoryProjectId, sourceIds, cursor) =>
            listSourcesInTurn(
              (linked.get(factoryProjectId) ?? []).filter(repository => sourceIds.includes(repository.id)),
              cursor,
              async (repository, inner) => {
                const projectId = Number(repository.externalId);
                if (!repository.host || !Number.isSafeInteger(projectId) || projectId <= 0) {
                  throw new Error(`GitLab repository ${repository.slug} has no usable project reference.`);
                }
                const target = await gitlab.versionControl.getRepositoryTarget({
                  orgId,
                  repositoryId: repository.repositoryId,
                });
                const page = await gitlab.versionControl.listPullRequests({
                  ...target,
                  includeDrafts: false,
                  cursor: inner ?? '1',
                });
                const project = { host: repository.host, projectId, projectPath: repository.slug };
                return {
                  items: page.pullRequests.map(mergeRequest => ({ repository, project, mergeRequest })),
                  nextCursor: page.nextCursor,
                };
              },
            ),
        };
      },
      record: gitlabMergeRequestRecord,
      sourceId: ({ repository }) => repository.id,
      itemKeys: item => [attachedKey(gitlabMergeRequestRecord(item).source.externalId)],
      cardKeys: attachedKeys,
      offer: (_project, items) =>
        ingest(items.map(({ project, mergeRequest }) => listedMergeRequestEvents(project, mergeRequest)[0]!)),
      // The listing is also what notices a new head commit on a merge request that has a card.
      refresh: items =>
        ingest(items.flatMap(({ project, mergeRequest }) => listedMergeRequestEvents(project, mergeRequest).slice(1))),
    }),
  ];
}
