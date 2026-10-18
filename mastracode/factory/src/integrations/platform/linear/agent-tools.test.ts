import { RequestContext } from '@mastra/core/request-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlatformApiError } from '../api-client.js';
import { buildPlatformLinearAgentTools } from './agent-tools.js';
import type { PlatformLinearIntegration } from './integration.js';

const teams = [
  { id: '11111111-1111-4111-8111-111111111111', key: 'ENG', name: 'Engineering', workspaceId: 'org-acme', workspaceName: 'Acme', connectionId: 'conn-acme' },
  { id: '22222222-2222-4222-8222-222222222222', key: 'OPS', name: 'Operations', workspaceId: 'org-beta', workspaceName: 'Beta', connectionId: 'conn-beta' },
];

let linear: {
  authEnabled: boolean;
  resolveOrgId: ReturnType<typeof vi.fn>;
  hasActiveConnections: ReturnType<typeof vi.fn>;
  listAllTeams: ReturnType<typeof vi.fn>;
  createIssue: ReturnType<typeof vi.fn>;
  getIssueDetail: ReturnType<typeof vi.fn>;
  commentOnIssue: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  linear = {
    authEnabled: true,
    resolveOrgId: vi.fn(async () => 'org-1'),
    hasActiveConnections: vi.fn(async () => true),
    listAllTeams: vi.fn(async () => teams),
    createIssue: vi.fn(async () => ({ id: 'i', identifier: 'ENG-99', title: 't', url: 'https://linear.app/i' })),
    getIssueDetail: vi.fn(async () => ({ identifier: 'ENG-42', title: 'Fix intake' })),
    commentOnIssue: vi.fn(async () => ({ id: 'c', url: 'https://linear.app/c' })),
  };
});

function requestContext(resourceId = 'project-1'): RequestContext {
  const ctx = new RequestContext();
  ctx.set('controller', { resourceId, getState: () => ({}) });
  return ctx;
}

async function tools() {
  return buildPlatformLinearAgentTools({
    requestContext: requestContext(),
    linear: linear as unknown as PlatformLinearIntegration,
  });
}

async function run(id: string, input: Record<string, unknown>) {
  const tool = (await tools())[id] as unknown as { execute: (input: unknown, ctx: unknown) => Promise<any> };
  return tool.execute(input, {});
}

describe('buildPlatformLinearAgentTools', () => {
  it('exposes get, comment and create tools for an org with an active connection', async () => {
    expect(Object.keys(await tools()).sort()).toEqual(['linear_create_comment', 'linear_create_issue', 'linear_get_issue']);
  });

  it('exposes nothing without auth, an org-owned project, or an active connection', async () => {
    linear.authEnabled = false;
    expect(await tools()).toEqual({});
    linear.authEnabled = true;
    linear.resolveOrgId.mockResolvedValueOnce(null);
    expect(await tools()).toEqual({});
    linear.hasActiveConnections.mockResolvedValueOnce(false);
    expect(await tools()).toEqual({});
  });

  it('linear_get_issue returns detail or a not-found error', async () => {
    await expect(run('linear_get_issue', { issue: 'ENG-42' })).resolves.toMatchObject({ title: 'Fix intake' });
    linear.getIssueDetail.mockResolvedValueOnce(null);
    await expect(run('linear_get_issue', { issue: 'ENG-1' })).resolves.toEqual({
      error: 'Linear issue "ENG-1" was not found.',
    });
  });

  it('linear_create_comment posts through the integration and maps auth failures', async () => {
    await expect(run('linear_create_comment', { issue: 'ENG-42', body: 'hi' })).resolves.toEqual({
      posted: true,
      url: 'https://linear.app/c',
    });
    expect(linear.commentOnIssue).toHaveBeenCalledWith('ENG-42', 'hi');

    linear.commentOnIssue.mockRejectedValueOnce(new PlatformApiError('nope', 401));
    await expect(run('linear_create_comment', { issue: 'ENG-42', body: 'hi' })).resolves.toEqual({
      error: 'Linear rejected the connected account. Reconnect Linear in Settings.',
    });
  });

  describe('linear_create_issue', () => {
    it('resolves the team by key (case-insensitive) in its own workspace', async () => {
      await expect(run('linear_create_issue', { title: 'Bug', team: 'ops', priority: 2 })).resolves.toEqual({
        created: true,
        identifier: 'ENG-99',
        url: 'https://linear.app/i',
      });
      expect(linear.createIssue).toHaveBeenCalledWith('conn-beta', { teamId: teams[1]!.id, title: 'Bug', priority: 2 });
    });

    it('resolves the team by name or UUID', async () => {
      await run('linear_create_issue', { title: 'A', team: 'engineering' });
      await run('linear_create_issue', { title: 'B', team: teams[1]!.id });
      expect(linear.createIssue.mock.calls.map(call => call[1].teamId)).toEqual([teams[0]!.id, teams[1]!.id]);
    });

    it('defaults to the only team', async () => {
      linear.listAllTeams.mockResolvedValueOnce([teams[0]]);
      await run('linear_create_issue', { title: 'Bug', description: 'Body' });
      expect(linear.createIssue).toHaveBeenCalledWith('conn-acme', { teamId: teams[0]!.id, title: 'Bug', description: 'Body' });
    });

    it('asks for a team listing the keys when ambiguous or unknown', async () => {
      await expect(run('linear_create_issue', { title: 'Bug' })).resolves.toEqual({
        error: 'Specify a team. Available teams: ENG, OPS.',
      });
      await expect(run('linear_create_issue', { title: 'Bug', team: 'XYZ' })).resolves.toEqual({
        error: 'Linear team "XYZ" was not found. Available teams: ENG, OPS.',
      });
      expect(linear.createIssue).not.toHaveBeenCalled();
    });

    it('refuses a team key shared by two workspaces and names each match', async () => {
      const otherEng = {
        id: '33333333-3333-4333-8333-333333333333',
        key: 'ENG',
        name: 'Eng',
        workspaceId: 'org-beta',
        workspaceName: 'Beta',
        connectionId: 'conn-beta',
      };
      linear.listAllTeams.mockResolvedValue([...teams, otherEng]);
      await expect(run('linear_create_issue', { title: 'Bug', team: 'ENG' })).resolves.toEqual({
        error: `Linear team "ENG" matches teams in more than one workspace. Pass the team id instead: ENG (Acme): ${teams[0]!.id}, ENG (Beta): ${otherEng.id}.`,
      });
      expect(linear.createIssue).not.toHaveBeenCalled();

      await run('linear_create_issue', { title: 'Bug', team: otherEng.id });
      expect(linear.createIssue).toHaveBeenCalledWith('conn-beta', { teamId: otherEng.id, title: 'Bug' });
    });
  });
});
