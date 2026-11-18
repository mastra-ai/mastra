import { searchTerms } from '@mastra/factory/work-items/search-terms';
import { describe, expect, it } from 'vitest';

import type { WorkItem } from '../../factory/services/workItems';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { createSessionSearchGroups, createWorkItemSearchResults, matchingResults } from './searchResults';

const FACTORY_ID = 'factory-1';
const AT = '2026-11-01T10:00:00.000Z';

function session(sessionId: string, branch: string): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: 'repository-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    branch,
    baseBranch: 'main',
    sandboxId: `sandbox-${sessionId}`,
    sandboxWorkdir: `/workspaces/${sessionId}`,
    materializedAt: AT,
    createdAt: AT,
    updatedAt: AT,
  };
}

function source(key: string, url: string, metadata: Record<string, unknown>, sourceType = 'issue') {
  return {
    id: key,
    workItemId: key,
    provider: 'github' as const,
    integrationId: 'github',
    sourceType,
    workspaceId: null,
    externalId: key,
    sourceKey: null,
    key,
    url,
    state: 'open',
    labels: [],
    author: null,
    metadata,
    revision: 1,
    syncedAt: null,
    createdAt: new Date(AT),
    updatedAt: new Date(AT),
  };
}

/** A GitHub issue card, with the pull requests attached to it, as the board's read sends it. */
function issueCard(
  id: string,
  title: string,
  number: number,
  options: { sessionId?: string; pullRequests?: Array<{ number: number; headBranch: string }> } = {},
): WorkItem {
  const url = `https://github.com/acme/app/issues/${number}`;
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: FACTORY_ID,
    source: 'github-issue',
    sourceKey: `github:1:issue:${number}`,
    parentWorkItemId: null,
    title,
    url,
    stages: ['intake'],
    stageHistory: [],
    sessions: options.sessionId
      ? {
          build: {
            sessionId: options.sessionId,
            branch: `factory/issue-${number}`,
            threadId: 't',
            startedBy: 'user-1',
          },
        }
      : {},
    metadata: {},
    workItem: {
      provider: 'github',
      key: `acme/app#${number}`,
      url,
      title,
      state: 'open',
      labels: [],
      author: null,
      metadata: { number },
      sources: [
        source(`acme/app#${number}`, url, { number }),
        ...(options.pullRequests ?? []).map(pullRequest =>
          source(
            `acme/app#${pullRequest.number}`,
            `https://github.com/acme/app/pull/${pullRequest.number}`,
            { githubPullRequestNumber: pullRequest.number, headBranch: pullRequest.headBranch },
            'pull-request',
          ),
        ),
      ],
    },
    triageType: null,
    acceptedAt: null,
    description: null,
    revision: 1,
    createdAt: AT,
    updatedAt: AT,
  };
}

const working = issueCard('card-login', 'Fix the login flow', 12, {
  sessionId: 'session-login',
  pullRequests: [{ number: 307, headBranch: 'octo.cat/login-redirect' }],
});
const longerNumber = issueCard('card-palette', 'Tidy the palette', 123, { sessionId: 'session-palette' });
const unstarted = issueCard('card-sync', 'Slow sync', 30772);

const sessions = createSessionSearchGroups({
  factoryId: FACTORY_ID,
  repositories: [
    {
      workspaces: [session('session-login', 'factory/issue-12'), session('session-palette', 'factory/issue-123')],
      userSessions: [session('session-notes', 'user/research-notes')],
    },
  ],
  workItems: [working, longerNumber],
});
const cards = createWorkItemSearchResults({ factoryId: FACTORY_ID, workItems: [unstarted] });
const rows = [...sessions.work, ...sessions.user, ...cards];

/** The titles of the rows the palette shows for what is typed. */
function shown(typed: string): string[] {
  const terms = searchTerms(typed);
  const kept = matchingResults(rows, terms);
  // The palette's own filter keeps a row whose value holds every typed word: it must keep each of these.
  for (const row of kept) {
    for (const word of typed.toLowerCase().split(/\s+/).filter(Boolean)) {
      expect(row.value.toLowerCase()).toContain(word);
    }
  }
  return kept.map(row => row.title).sort();
}

describe('the palette’s rows for what is typed, as the board’s search reads them', () => {
  it('shows every row while nothing is typed', () => {
    expect(matchingResults(rows, searchTerms('  '))).toBe(rows);
  });

  it('finds a card by the pull request attached to it: its number, its key, its link to any page, its branch', () => {
    for (const typed of [
      '#307',
      'acme/app#307',
      'https://github.com/acme/app/pull/307/files#diff-1',
      'github.com/Acme/App/pull/307?tab=checks',
      'octo.cat/login-redirect',
    ]) {
      expect(shown(typed), typed).toEqual(['Fix the login flow']);
    }
  });

  it('finds a whole number, never one it starts, while bare digits find every number holding them', () => {
    expect(shown('#12')).toEqual(['Fix the login flow']);
    expect(shown('#123')).toEqual(['Tidy the palette']);
    expect(shown('12')).toEqual(['Fix the login flow', 'Tidy the palette']);
  });

  it('keeps no row for two links when the card answers only one, though the first is in the second', () => {
    expect(shown('https://github.com/acme/app/pull/30 https://github.com/acme/app/pull/307')).toEqual([]);
  });

  it('reads the row’s own words too: its branch, its session, its kind', () => {
    expect(shown('research-notes')).toEqual(['research-notes']);
    expect(shown('factory/issue-12')).toEqual(['Fix the login flow', 'Tidy the palette']);
    expect(shown('work-session login')).toEqual(['Fix the login flow']);
  });

  it('finds a card nobody started by its id, its link, or a title word', () => {
    expect(shown('card-sync')).toEqual(['Slow sync']);
    expect(shown('https://github.com/acme/app/issues/30772')).toEqual(['Slow sync']);
    expect(shown('slow')).toEqual(['Slow sync']);
  });
});
