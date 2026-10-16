import { afterEach, describe, expect, it, vi } from 'vitest';

const sessionSpy = vi.fn((sessionId: string) => ({ sessionId }));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class {
    getAgentController() {
      return { session: sessionSpy };
    }
  },
}));

import type { WorkspaceSkillInvocationError } from '../agentControllerClient';
import { createAgentControllerClient, invokeWorkspaceSkill, prepareWorkspaceSkill } from '../agentControllerClient';

afterEach(() => vi.restoreAllMocks());

describe('createAgentControllerClient', () => {
  it('addresses the server session by its session id', () => {
    createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'session-1',
      baseUrl: 'http://session-test',
    });

    expect(sessionSpy).toHaveBeenCalledWith('session-1');
  });

  it('caches one client session per session id', () => {
    const a = createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'session-a',
      baseUrl: 'http://cache-test',
    });
    const b = createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'session-b',
      baseUrl: 'http://cache-test',
    });
    const aAgain = createAgentControllerClient({
      agentControllerId: 'controller',
      resourceId: 'session-a',
      baseUrl: 'http://cache-test',
    });

    expect(a.session).not.toBe(b.session);
    expect(aAgain.session).toBe(a.session);
  });
});

describe('workspace skill requests', () => {
  it('prepares a session skill without invoking it', async () => {
    const message = '<skill name="understand-issue">\nInvestigate it.\n</skill>';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, skill: 'understand-issue', message })));

    const result = await prepareWorkspaceSkill({
      agentControllerId: 'code',
      sessionId: 'session-1',
      name: 'understand-issue',
      baseUrl: 'https://code.example',
    });

    expect(result).toEqual({ skill: 'understand-issue', message });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://code.example/web/agent-controller/code/skills/prepare',
      expect.anything(),
    );
  });

  it('posts the session skill request with browser credentials', async () => {
    const message = '<skill name="understand-pr">\nReview it.\n</skill>';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, skill: 'understand-pr', message })));

    const result = await invokeWorkspaceSkill({
      agentControllerId: 'code',
      sessionId: 'session-1',
      name: 'understand-pr',
      arguments: 'octo/repo#42',
      baseUrl: 'https://code.example',
    });

    expect(result).toEqual({ skill: 'understand-pr', message });
    expect(fetchSpy).toHaveBeenCalledWith('https://code.example/web/agent-controller/code/skills/invoke', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'session-1',
        name: 'understand-pr',
        arguments: 'octo/repo#42',
      }),
    });
  });

  it('normalizes malformed successful responses to a typed error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json'));

    const invocation = invokeWorkspaceSkill({
      agentControllerId: 'code',
      sessionId: 'session-1',
      name: 'understand-pr',
    });

    await expect(invocation).rejects.toEqual(
      expect.objectContaining<Partial<WorkspaceSkillInvocationError>>({
        name: 'WorkspaceSkillInvocationError',
        status: 502,
        code: 'invalid_response',
      }),
    );
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
      sessionId: 'session-1',
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
