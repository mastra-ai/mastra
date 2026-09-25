import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { canCallerActAsFactorySession } from './authorize-session-resource.js';

const row = (visibility: 'private' | 'org' = 'private') =>
  ({ sessionId: 'session-1', orgId: 'org-1', userId: 'owner', visibility }) as SourceControlSession;

const as = (user?: { workosId?: string; organizationId?: string }) => {
  const requestContext = new RequestContext();
  if (user) requestContext.set('user', user);
  return requestContext;
};

describe('canCallerActAsFactorySession', () => {
  it.each([
    ['the owner of a private session', row(), { workosId: 'owner', organizationId: 'org-1' }, true],
    ['an org member on an org-visible session', row('org'), { workosId: 'peer', organizationId: 'org-1' }, true],
    ['an org member on a private session', row(), { workosId: 'peer', organizationId: 'org-1' }, false],
    ['a caller from another org', row('org'), { workosId: 'owner', organizationId: 'org-2' }, false],
    ['a caller with no org', row(), { workosId: 'owner' }, false],
    ['an anonymous caller', row(), undefined, false],
    ['anyone, when the session row does not exist', null, { workosId: 'owner', organizationId: 'org-1' }, false],
  ])('source-control session: %s → %s', async (_label, session, user, expected) => {
    const getBySessionId = vi.fn(async () => session);
    await expect(canCallerActAsFactorySession({ sessions: { getBySessionId } }, 'session-1', as(user))).resolves.toBe(
      expected,
    );
    if (user?.organizationId && user.workosId) expect(getBySessionId).toHaveBeenCalledWith('session-1');
  });

  it.each([
    ['a member of the org that owns the project', { id: 'project-1' } as FactoryProject, true],
    ['a caller whose org does not own the project', null, false],
  ])('supervisor session: %s → %s', async (_label, project, expected) => {
    const get = vi.fn(async () => project);
    const getBySessionId = vi.fn();
    await expect(
      canCallerActAsFactorySession(
        { sessions: { getBySessionId }, projects: { get } },
        'factory-supervisor:project-1',
        as({ workosId: 'peer', organizationId: 'org-1' }),
      ),
    ).resolves.toBe(expected);
    expect(get).toHaveBeenCalledWith({ orgId: 'org-1', id: 'project-1' });
    expect(getBySessionId).not.toHaveBeenCalled();
  });

  it('denies when the storage that would prove access is not available', async () => {
    const user = as({ workosId: 'owner', organizationId: 'org-1' });
    await expect(canCallerActAsFactorySession({}, 'session-1', user)).resolves.toBe(false);
    await expect(canCallerActAsFactorySession({}, 'factory-supervisor:project-1', user)).resolves.toBe(false);
  });

  it('denies instead of throwing when a lookup fails', async () => {
    const user = as({ workosId: 'owner', organizationId: 'org-1' });
    const fail = async () => {
      throw new Error('Factory session exists in multiple source-control providers.');
    };
    await expect(canCallerActAsFactorySession({ sessions: { getBySessionId: fail } }, 'session-1', user)).resolves.toBe(
      false,
    );
    await expect(
      canCallerActAsFactorySession({ projects: { get: fail } }, 'factory-supervisor:project-1', user),
    ).resolves.toBe(false);
  });
});
