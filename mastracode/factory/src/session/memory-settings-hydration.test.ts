import type { MastraCodeState } from '@mastra/code-sdk/schema';

import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import {
  hydrateSessionMemorySettings,
  type MemorySettingsHydrationDependencies,
  type MemorySettingsHydrationSession,
} from './memory-settings-hydration.js';

function createSession(state: MastraCodeState = {}) {
  return {
    identity: { getResourceId: () => 'session-1' },
    state: {
      get: () => state,
      set: vi.fn(async updates => Object.assign(state, updates)),
    },
  } satisfies MemorySettingsHydrationSession;
}

function sourceControlRow(): SourceControlSession {
  return {
    id: 'row-1',
    sessionId: 'session-1',
    projectRepositoryId: 'repo-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'user/session-1',
    title: null,
    visibility: 'private',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    firstMessageAt: null,
    firstMeaningfulExecAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createDependencies(
  row: SourceControlSession | null = sourceControlRow(),
): MemorySettingsHydrationDependencies {
  return {
    sourceControl: { sessions: { getBySessionId: vi.fn().mockResolvedValue(row) } },
  };
}

describe('hydrateSessionMemorySettings', () => {
  it('seeds the tenant org from the session source-control row', async () => {
    const session = createSession();
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).toHaveBeenCalledExactlyOnceWith('session-1');
    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('overwrites a stale org with the authoritative row org', async () => {
    const session = createSession({ factoryOrgId: 'stale-org' });

    await hydrateSessionMemorySettings(session, createDependencies());

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('marks the session unresolved when it has no source-control row', async () => {
    const session = createSession();

    await hydrateSessionMemorySettings(session, createDependencies(null));

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
  });

  it('re-resolves a tagged session whose stored org is blank', async () => {
    const session = createSession({ factoryProjectId: 'project-1', factoryOrgId: '   ' });

    await hydrateSessionMemorySettings(session, createDependencies());

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('skips fully hydrated factory-run sessions owned by the start coordinator', async () => {
    const session = createSession({ factoryProjectId: 'project-1', factoryOrgId: 'org-1' });
    const dependencies = createDependencies();

    await hydrateSessionMemorySettings(session, dependencies);

    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(session.state.set).not.toHaveBeenCalled();
  });

  it('warns and marks the org unresolved when lookup fails', async () => {
    const session = createSession();
    const dependencies = createDependencies();
    dependencies.sourceControl.sessions.getBySessionId = vi.fn().mockRejectedValue(new Error('storage down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(hydrateSessionMemorySettings(session, dependencies)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[Factory session hydration] Unable to resolve the session organization.',
      expect.any(Error),
    );
    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
    warn.mockRestore();
  });
});
