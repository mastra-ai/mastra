import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeRouteAuth } from '../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import { buildGitLabAgentTools } from './agent-tools.js';
import { GitLabApiError } from './api.js';
import { GitLabIntegration } from './integration.js';

let seed!: FactoryStorageTestSeed;
let gitlab!: GitLabIntegration;
let projectId = '';
const getIssue = vi.fn();

function requestContextFor(resourceId: string | undefined): RequestContext {
  const context = new RequestContext();
  if (resourceId) context.set('controller', { resourceId });
  return context;
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  gitlab = new GitLabIntegration({ accessToken: 'group-token' });
  gitlab.initialize({ projects: seed.projects, auth: fakeRouteAuth() });
  vi.spyOn(gitlab.intake, 'getIssue').mockImplementation(input => getIssue(input.issueId));
  getIssue.mockReset();
  projectId = '';
});

async function seedProject(): Promise<void> {
  const project = await seed.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: 'Acme app' },
  });
  projectId = project.id;
}

describe('buildGitLabAgentTools', () => {
  it('exposes a read-only issue tool for org-owned factory projects', async () => {
    await seedProject();
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });
    expect(Object.keys(tools)).toEqual(['gitlab_get_issue']);
  });

  it('does not expose tools without auth or a factory project', async () => {
    gitlab.initialize({ projects: seed.projects, auth: fakeRouteAuth({ enabled: false }) });
    expect(await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor('local-default') })).toEqual({});
  });

  it('returns issue details and rejects whitespace-only identifiers', async () => {
    await seedProject();
    getIssue.mockResolvedValueOnce({ identifier: 'mastra/platform#42', title: 'Fix intake sync' });
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });

    await expect((tools.gitlab_get_issue!.execute as any)({ issue: ' mastra/platform#42 ' })).resolves.toEqual({
      identifier: 'mastra/platform#42',
      title: 'Fix intake sync',
    });
    expect(getIssue).toHaveBeenCalledWith('mastra/platform#42');
    expect((tools.gitlab_get_issue!.inputSchema as any).safeParse({ issue: '   ' }).success).toBe(false);
  });

  it('maps token failures to an operator-facing error', async () => {
    await seedProject();
    getIssue.mockRejectedValueOnce(new GitLabApiError('unauthorized', 401));
    const tools = await buildGitLabAgentTools({ gitlab, requestContext: requestContextFor(projectId) });

    await expect((tools.gitlab_get_issue!.execute as any)({ issue: 'mastra/platform#42' })).resolves.toEqual({
      error: 'GitLab rejected the configured access token. Check the GitLab token.',
    });
  });
});
