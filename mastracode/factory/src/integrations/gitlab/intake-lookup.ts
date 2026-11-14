import { cardRuleFacts } from '../../boards/card-facts.js';
import type { IntakeItemLookup } from '../../boards/intake-lookup.js';
import { externalSourceForWorkItem } from '../../rules/types.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { GitLabIssue, GitLabMergeRequest } from './api.js';
import { encodeIssueReference, GITLAB_TRUSTED_ACCESS_LEVEL, normalizeGitLabHost } from './integration.js';
import { mergeRequestSourceKey } from './rules.js';

const GITLAB_ITEM_URL = /^https?:\/\/([^/]+)\/(.+?)\/-\/(issues|work_items|merge_requests)\/(\d+)(?:[/?#].*)?$/i;

export interface GitLabIntakeLookupDeps {
  sourceControl(): SourceControlStorageHandle | undefined;
  readWorkItem(
    connectionId: string,
    projectId: string,
    kind: 'issue' | 'merge_request',
    iid: number,
  ): Promise<GitLabIssue | GitLabMergeRequest>;
  getProjectMemberAccessLevel(connectionId: string, projectId: string, username: string): Promise<number | undefined>;
}

function usernames(users: ReadonlyArray<{ username?: string }> | undefined): string[] {
  return (users ?? []).map(user => user.username).filter((name): name is string => Boolean(name));
}

/**
 * Reads a GitLab issue or merge request for the intake tester, only from a project linked to the
 * Factory project on the URL's host and only through that link's connection. It builds the facts
 * the webhook arrival would carry, with author trust from the author's project access.
 */
export function gitlabIntakeLookup(deps: GitLabIntakeLookupDeps): IntakeItemLookup {
  return {
    async lookup(scope, url) {
      const match = GITLAB_ITEM_URL.exec(url.trim());
      if (!match) return undefined;
      const [, rawHost = '', rawPath = '', type = '', digits = ''] = match;
      const host = normalizeGitLabHost(rawHost);
      const path = rawPath.toLowerCase();
      const kind = type.toLowerCase() === 'merge_requests' ? 'merge_request' : 'issue';
      const iid = Number(digits);
      const sourceControl = deps.sourceControl();
      const connections = sourceControl
        ? await sourceControl.connections.listWithRepositories({
            orgId: scope.orgId,
            factoryProjectIds: [scope.factoryProjectId],
          })
        : [];
      const linked = connections
        .filter(connection => {
          const linkedHost = connection.installation.providerMetadata.host;
          return typeof linkedHost === 'string' && normalizeGitLabHost(linkedHost) === host;
        })
        .flatMap(connection =>
          connection.repositories.map(link => ({ installation: connection.installation, repository: link.repository })),
        )
        .find(({ repository }) => repository?.slug.toLowerCase() === path);
      if (!linked?.repository) return { status: 'not_linked' };
      const connectionId = linked.installation.externalId;
      const projectId = linked.repository.externalId;

      const item = await deps.readWorkItem(connectionId, projectId, kind, iid).catch(() => undefined);
      if (!item) return { status: 'not_found' };
      const author = item.author?.username;
      const trusted = author
        ? ((await deps.getProjectMemberAccessLevel(connectionId, projectId, author).catch(() => undefined)) ?? 0) >=
          GITLAB_TRUSTED_ACCESS_LEVEL
        : false;
      const shared = {
        gitlabHost: host,
        gitlabProjectId: Number(projectId),
        ...(author ? { author } : {}),
        authorTrusted: trusted,
        assignees: usernames(item.assignees),
        labels: item.labels ?? [],
      };
      const mergeRequest = 'source_branch' in item ? item : null;
      const metadata: Record<string, unknown> = mergeRequest
        ? {
            ...shared,
            gitlabMergeRequestIid: iid,
            state: mergeRequest.state === 'opened' || mergeRequest.state === 'locked' ? 'open' : 'closed',
            draft: mergeRequest.draft ?? mergeRequest.work_in_progress ?? false,
            merged: mergeRequest.state === 'merged',
            requestedReviewers: usernames(mergeRequest.reviewers),
            headBranch: mergeRequest.source_branch,
            baseBranch: mergeRequest.target_branch,
          }
        : { ...shared, gitlabIssueIid: iid, identifier: `${linked.repository.slug}#${iid}` };
      const sourceKey = mergeRequest
        ? mergeRequestSourceKey(host, Number(projectId), iid)
        : encodeIssueReference({ host, projectId, issueIid: iid });
      return {
        status: 'found',
        title: item.title,
        url: item.web_url,
        facts: cardRuleFacts({
          title: item.title,
          metadata,
          externalSource: externalSourceForWorkItem(mergeRequest ? 'gitlab-pr' : 'gitlab-issue', sourceKey, item.web_url),
        }),
      };
    },
  };
}
