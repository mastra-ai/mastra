import type { WorkItem } from '../../../../factory/services/workItems';
import { buildFactorySessionRow, buildUserSessionRow } from '../../sessionRows';
import type { FactorySessionRowInput, SessionListRow } from '../../sessionRows';
import type { FactoryUserSession } from '../../user-sessions';

export function testSession(sessionId: string, overrides: Partial<FactoryUserSession> = {}): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId: 'repo-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    branch: `factory/issue-${sessionId}`,
    baseBranch: 'main',
    sandboxId: 'sandbox-1',
    sandboxWorkdir: '/workspace',
    materializedAt: '2026-09-04T09:00:00.000Z',
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
    ...overrides,
  };
}

export function testWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'repo-1',
    board: 'work',
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title: 'Ship it',
    url: null,
    stages: ['execute'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
    ...overrides,
  };
}

export function factoryRow(
  session: FactoryUserSession,
  input: Partial<Omit<FactorySessionRowInput, 'session'>> = {},
): SessionListRow {
  return buildFactorySessionRow({
    session,
    item: undefined,
    boards: undefined,
    threadId: undefined,
    pullRequest: undefined,
    factoryId: 'fp-1',
    routeSessionId: undefined,
    running: false,
    attention: false,
    pinned: false,
    viewer: undefined,
    ...input,
  });
}

export function userRow(
  sessionId: string,
  overrides: Partial<FactoryUserSession> = {},
  input: { running?: boolean; pinned?: boolean } = {},
): SessionListRow {
  return buildUserSessionRow({
    item: undefined,
    session: testSession(sessionId, { branch: `user/${sessionId}`, ...overrides }),
    factoryId: 'fp-1',
    pathname: '/factories/fp-1',
    running: input.running ?? false,
    pinned: input.pinned ?? false,
    viewer: undefined,
  });
}
