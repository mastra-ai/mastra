import { afterEach, describe, expect, it, vi } from 'vitest';

const sessionSpy = vi.fn((resourceId: string, scope?: string) => ({ resourceId, scope }));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class {
    getAgentController() {
      return { session: sessionSpy };
    }
  },
}));

import {
  createAgentControllerClient,
  invokeWorkspaceSkill,
  WorkspaceSkillInvocationError,
} from '../agentControllerClient';

afterEach(() => vi.restoreAllMocks());

describe('createAgentControllerClient', () => {
  it('given a worktree scope, then the server session is created with that scope (regression: dropping it merged all worktrees into one session)', () => {
    createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'org-1',
      scope: '/worktrees/factory-issue-12',
      baseUrl: 'http://scope-test',
    });

    expect(sessionSpy).toHaveBeenCalledWith('org-1', '/worktrees/factory-issue-12');
  });

  it('given no scope, then the session is created unscoped', () => {
    createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'org-1',
      baseUrl: 'http://unscoped-test',
    });

    expect(sessionSpy).toHaveBeenCalledWith('org-1', undefined);
  });

  it('given two scopes over the same resource, then each gets its own cached session', () => {
    const a = createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'org-1',
      scope: '/worktrees/a',
      baseUrl: 'http://cache-test',
    });
    const b = createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'org-1',
      scope: '/worktrees/b',
      baseUrl: 'http://cache-test',
    });
    const aAgain = createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'org-1',
      scope: '/worktrees/a',
      baseUrl: 'http://cache-test',
    });

    expect(a.session).not.toBe(b.session);
    expect(aAgain.session).toBe(a.session);
  });
});

describe('invokeWorkspaceSkill', () => {
  it('posts the scoped skill request with browser credentials', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await invokeWorkspaceSkill({
      agentControllerId: 'code',
      resourceId: 'project-1',
      scope: '/worktrees/review-42',
      name: 'understand-pr',
      arguments: 'octo/repo#42',
      baseUrl: 'https://code.example',
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://code.example/web/agent-controller/code/skills/invoke', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        resourceId: 'project-1',
        scope: '/worktrees/review-42',
        name: 'understand-pr',
        arguments: 'octo/repo#42',
      }),
    });
  });

  it('surfaces typed server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'skill_not_found', message: 'Skill not found: understand-pr.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const invocation = invokeWorkspaceSkill({
      agentControllerId: 'code',
      resourceId: 'project-1',
      scope: '/worktrees/review-42',
      name: 'understand-pr',
    });

    await expect(invocation).rejects.toEqual(
      expect.objectContaining<Partial<WorkspaceSkillInvocationError>>({
        name: 'WorkspaceSkillInvocationError',
        message: 'Skill not found: understand-pr.',
        status: 404,
        code: 'skill_not_found',
      }),
    );
  });
});
