import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { buildJiraAgentTools } from './agent-tools.js';
import { JiraApiError } from './api.js';
import { JiraIntegration } from './integration.js';

// A real integration instance backed by seeded `:memory:` storage. Only the
// network edges (the intake capability calls) are spied out, so the project →
// org resolution and exposure gating run the production paths.
let seed!: FactoryStorageTestSeed;
let jira!: JiraIntegration;

const fetchJiraIssueDetail = vi.fn();
const createJiraIssueComment = vi.fn();

let PROJECT_ID = '';
const ORG_ID = 'org-1';

function requestContextFor(resourceId: string | undefined): RequestContext {
  const ctx = new RequestContext();
  if (resourceId !== undefined) {
    ctx.set('controller', { resourceId });
  }
  return ctx;
}

async function seedProject(): Promise<void> {
  const project = await seed.projects.create({
    orgId: ORG_ID,
    userId: 'user-1',
    input: { name: 'Acme app' },
  });
  PROJECT_ID = project.id;
}

const issueDetail = {
  id: '10001',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  description: 'It syncs the wrong way.',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  author: 'Grace',
  state: 'To Do',
  stateType: 'unstarted',
  priority: 'High',
  assignee: 'Ada',
  source: 'ENG',
  labels: ['bug'],
  commentCount: 1,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  comments: [{ author: 'Grace', body: 'Repro attached.', createdAt: '2026-07-01T12:00:00Z' }],
};

beforeEach(async () => {
  PROJECT_ID = '';
  seed = await createFactoryStorageForTests();
  jira = new JiraIntegration({ baseUrl: 'https://acme.atlassian.net', email: 'ops@acme.test', apiToken: 'jira-token' });
  jira.initialize({ projects: seed.projects, auth: fakeRouteAuth() });
  vi.spyOn(jira.intake, 'getIssue').mockImplementation(input => fetchJiraIssueDetail(input.issueId));
  vi.spyOn(jira.intake, 'createComment').mockImplementation(input => createJiraIssueComment(input.issueId, input.body));
  fetchJiraIssueDetail.mockReset();
  createJiraIssueComment.mockReset();
});

describe('buildJiraAgentTools — exposure gating', () => {
  it('exposes only the read-only jira_get_issue tool for org-owned factory projects', async () => {
    await seedProject();
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    // v1 is intake-only: no mutating Jira tool (comment/transition) may leak
    // into the agent tool record.
    expect(Object.keys(tools)).toEqual(['jira_get_issue']);
  });

  it('exposes nothing when the host runs without web auth', async () => {
    await seedProject();
    jira.initialize({ projects: seed.projects, auth: fakeRouteAuth({ enabled: false }) });
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).toEqual({});
  });

  it('exposes nothing for resources that are not factory projects', async () => {
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor('local-default') });
    expect(tools).toEqual({});
  });

  it('exposes nothing when there is no controller context', async () => {
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(undefined) });
    expect(tools).toEqual({});
  });
});

describe('jira_get_issue', () => {
  it('returns the full issue detail', async () => {
    await seedProject();
    fetchJiraIssueDetail.mockResolvedValueOnce(issueDetail);
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.jira_get_issue!.execute as any)({ issue: ' ENG-42 ' });
    expect(result).toEqual(issueDetail);
    expect(fetchJiraIssueDetail).toHaveBeenCalledWith('ENG-42');
  });

  it('reports unknown issues as a tool error', async () => {
    await seedProject();
    fetchJiraIssueDetail.mockResolvedValueOnce(null);
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.jira_get_issue!.execute as any)({ issue: 'ENG-404' });
    expect(result).toEqual({ error: 'Jira issue "ENG-404" was not found on this site.' });
  });

  it('maps credential rejections to an operator-facing error', async () => {
    await seedProject();
    fetchJiraIssueDetail.mockRejectedValueOnce(new JiraApiError('Jira API request failed (401)', 401));
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.jira_get_issue!.execute as any)({ issue: 'ENG-42' });
    expect(result).toEqual({
      error: 'Jira rejected the configured credentials. Ask the operator to check the Jira API token.',
    });
  });

  it('surfaces non-auth failures with the underlying message', async () => {
    await seedProject();
    fetchJiraIssueDetail.mockRejectedValueOnce(new JiraApiError('Jira API request failed (500)', 500));
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    const result = await (tools.jira_get_issue!.execute as any)({ issue: 'ENG-42' });
    expect(result).toEqual({ error: 'Failed to fetch Jira issue: Jira API request failed (500)' });
  });
});

describe('mutating tools stay internal in v1', () => {
  it('never exposes a comment or transition tool, even for org-owned projects', async () => {
    await seedProject();
    const tools = await buildJiraAgentTools({ jira, requestContext: requestContextFor(PROJECT_ID) });
    expect(tools).not.toHaveProperty('jira_create_comment');
    expect(tools).not.toHaveProperty('jira_update_issue');
    // The adapter still implements the full Intake contract internally — only
    // the agent-facing record is narrowed.
    expect(typeof jira.intake.createComment).toBe('function');
    expect(typeof jira.intake.updateIssue).toBe('function');
    expect(createJiraIssueComment).not.toHaveBeenCalled();
  });
});
