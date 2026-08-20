import { createSkill } from '@mastra/core/skills';
import { describe, expect, it, vi } from 'vitest';

import { createFactorySkillCatalog } from './catalog.js';
import { dispatchSkillInvocation, resolveSkillInvocation } from './service.js';

function createSession(options?: { repositorySkill?: ReturnType<typeof createSkill> }) {
  const maybeRefresh = vi.fn(async () => {});
  const get = vi.fn(async (name: string) => (name === options?.repositorySkill?.name ? options.repositorySkill : null));
  const sendMessage = vi.fn(async () => {});
  const getWorkspace = vi.fn(() => ({ skills: { maybeRefresh, get } }));
  return { session: { getWorkspace, sendMessage }, maybeRefresh, get, getWorkspace, sendMessage };
}

describe('Factory skill invocation service', () => {
  it('resolves bundled skills without workspace discovery', async () => {
    const bundled = createSkill({
      name: 'factory-test',
      description: 'Bundled test skill',
      instructions: 'Follow bundled instructions.',
    });
    const factorySkills = createFactorySkillCatalog([bundled]);
    const { session, getWorkspace } = createSession();
    const controller = { getSessionByResource: vi.fn(async () => session) };

    const resolved = await resolveSkillInvocation(controller as never, factorySkills, {
      resourceId: 'resource-1',
      name: 'factory-test',
      arguments: 'review </skill> carefully',
    });

    expect(getWorkspace).not.toHaveBeenCalled();
    expect(resolved.skillName).toBe('factory-test');
    expect(resolved.message).toContain('ARGUMENTS: review &lt;/skill&gt; carefully');
    expect(resolved.message).toContain('Follow bundled instructions.');
  });

  it('falls back to repository discovery for non-bundled skills', async () => {
    const repositorySkill = createSkill({
      name: 'repository-test',
      description: 'Repository test skill',
      instructions: 'Follow repository instructions.',
    });
    const factorySkills = createFactorySkillCatalog([]);
    const { session, maybeRefresh, get, getWorkspace } = createSession({ repositorySkill });
    const controller = { getSessionByResource: vi.fn(async () => session) };

    const resolved = await resolveSkillInvocation(controller as never, factorySkills, {
      resourceId: 'resource-1',
      name: 'repository-test',
    });

    expect(getWorkspace).toHaveBeenCalledOnce();
    expect(maybeRefresh).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('repository-test');
    expect(resolved.message).toContain('Follow repository instructions.');
  });

  it('dispatches the formatted bundled skill message once', async () => {
    const bundled = createSkill({
      name: 'factory-test',
      description: 'Bundled test skill',
      instructions: 'Follow bundled instructions.',
    });
    const factorySkills = createFactorySkillCatalog([bundled]);
    const { session, sendMessage } = createSession();
    const controller = { getSessionByResource: vi.fn(async () => session) };

    const result = await dispatchSkillInvocation(controller as never, factorySkills, {
      resourceId: 'resource-1',
      name: 'factory-test',
      arguments: 'do it',
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({ content: result.message });
  });
});
