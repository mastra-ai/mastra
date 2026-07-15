import { describe, expect, it, vi } from 'vitest';

const sessionSpy = vi.fn((resourceId: string, scope?: string) => ({ resourceId, scope }));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class {
    getAgentController() {
      return { session: sessionSpy };
    }
  },
}));

import { createAgentControllerClient } from '../agentControllerClient';

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
