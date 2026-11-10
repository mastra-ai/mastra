import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ settings: { factory: null as Record<string, unknown> | null } }));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: () => structuredClone(store.settings),
  saveSettings: (next: typeof store.settings) => {
    store.settings = structuredClone(next);
  },
}));

const platform = vi.hoisted(() => ({
  getPlatformSession: vi.fn(),
  loginToPlatform: vi.fn(),
  fetchPlatformOrgs: vi.fn(),
  fetchPlatformProjects: vi.fn(),
  fetchPlatformEnvironments: vi.fn(),
  resolveFactoryUrl: (env: { url?: string }) => env.url ?? null,
}));
const factoryClient = vi.hoisted(() => ({ listFactoryProjects: vi.fn(), createFactoryUserSession: vi.fn() }));
const prompt = vi.hoisted(() => ({ promptSelect: vi.fn() }));

vi.mock('@mastra/code-sdk/platform/index', () => platform);
vi.mock('@mastra/code-sdk/factory/client', () => factoryClient);
vi.mock('../../components/simple-select.js', () => prompt);

import { handleFactoryCommand, handleLocalCommand } from '../factory.js';
import type { SlashCommandContext } from '../types.js';

const saved = {
  url: 'https://shipyard.factory.mastra.cloud',
  orgId: 'org_1',
  projectId: 'p1',
  projectName: 'Shipyard',
  environmentId: 'e1',
  environmentName: 'production',
  factoryProjectId: 'fp1',
  factoryProjectName: 'Release notes',
  projectRepositoryId: 'r1',
  repositorySlug: 'mastra-ai/mastra',
  sessionId: 's1',
  branch: 'user/session-s1',
};

function makeCtx(mode: 'local' | 'factory', relaunch = vi.fn(async () => {})) {
  const ctx = {
    state: { local: mode === 'local' ? {} : undefined, options: { relaunch } },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
  return { ctx, relaunch };
}

describe('/factory and /local mode switching', () => {
  beforeEach(() => {
    store.settings = { factory: { ...saved } };
  });

  it('/factory from local mode reactivates the saved connection and relaunches', async () => {
    store.settings.factory!.active = false;
    const { ctx, relaunch } = makeCtx('local');
    await handleFactoryCommand(ctx, []);
    expect(store.settings.factory!.active).toBe(true);
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('/factory while already in Factory mode only reports status', async () => {
    const { ctx, relaunch } = makeCtx('factory');
    await handleFactoryCommand(ctx, []);
    expect(relaunch).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Factory mode:'));
  });

  it('/local keeps the connection but deactivates it and relaunches', async () => {
    const { ctx, relaunch } = makeCtx('factory');
    await handleLocalCommand(ctx);
    expect(store.settings.factory).toMatchObject({ sessionId: 's1', active: false });
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('/local in local mode does not relaunch', async () => {
    const { ctx, relaunch } = makeCtx('local');
    await handleLocalCommand(ctx);
    expect(relaunch).not.toHaveBeenCalled();
    expect(store.settings.factory!.active).toBe(false);
  });

  it('/factory disconnect from Factory mode forgets the connection and relaunches locally', async () => {
    const { ctx, relaunch } = makeCtx('factory');
    await handleFactoryCommand(ctx, ['disconnect']);
    expect(store.settings.factory).toBeNull();
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('asks for a manual restart when relaunching is unavailable', async () => {
    const ctx = {
      state: { local: {}, options: {} },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as unknown as SlashCommandContext;
    await handleFactoryCommand(ctx, []);
    expect(ctx.showInfo).toHaveBeenCalledWith('Restart Mastra Code to switch to Factory mode.');
  });
});

describe('/factory connect', () => {
  beforeEach(() => {
    store.settings = { factory: null };
    platform.getPlatformSession.mockResolvedValue({ token: 'tok', orgId: 'org_a' });
    platform.fetchPlatformOrgs.mockResolvedValue([
      { id: 'org_a', name: 'A' },
      { id: 'org_b', name: 'B' },
    ]);
    platform.fetchPlatformProjects.mockResolvedValue([{ id: 'p1', name: 'Shipyard' }]);
    platform.fetchPlatformEnvironments.mockResolvedValue([
      { id: 'e1', name: 'production', url: 'https://shipyard.factory.mastra.cloud' },
      { id: 'e2', name: 'undeployed' },
    ]);
    factoryClient.listFactoryProjects.mockResolvedValue([
      { id: 'empty', name: 'No repos', repositories: [] },
      {
        id: 'fp1',
        name: 'Release notes',
        repositories: [
          { projectRepositoryId: 'r1', slug: 'mastra-ai/mastra', branch: 'main' },
          { projectRepositoryId: 'r2', slug: 'mastra-ai/docs', branch: 'main' },
        ],
      },
    ]);
    factoryClient.createFactoryUserSession.mockResolvedValue({ sessionId: 's9', branch: 'user/session-s9' });
    prompt.promptSelect.mockReset();
  });

  it('saves the selected org, project, environment, repository, and new session before relaunching', async () => {
    prompt.promptSelect.mockResolvedValueOnce('org_b').mockResolvedValueOnce('p1').mockResolvedValueOnce('r2');
    const { ctx, relaunch } = makeCtx('local');
    relaunch.mockImplementation(async () => {
      expect(store.settings.factory).toMatchObject({ active: true, sessionId: 's9' });
    });

    await handleFactoryCommand(ctx, ['connect']);

    expect(ctx.showError).not.toHaveBeenCalled();
    expect(platform.fetchPlatformProjects).toHaveBeenCalledWith({ token: 'tok', orgId: 'org_b' });
    expect(factoryClient.createFactoryUserSession).toHaveBeenCalledWith(
      { url: 'https://shipyard.factory.mastra.cloud', session: { token: 'tok', orgId: 'org_b' } },
      'r2',
    );
    expect(store.settings.factory).toEqual({
      url: 'https://shipyard.factory.mastra.cloud',
      orgId: 'org_b',
      projectId: 'p1',
      projectName: 'Shipyard',
      environmentId: 'e1',
      environmentName: 'production',
      factoryProjectId: 'fp1',
      factoryProjectName: 'Release notes',
      projectRepositoryId: 'r2',
      repositorySlug: 'mastra-ai/docs',
      sessionId: 's9',
      branch: 'user/session-s9',
      active: true,
    });
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('uses the only org without prompting', async () => {
    platform.fetchPlatformOrgs.mockResolvedValue([{ id: 'org_only', name: 'Only' }]);
    prompt.promptSelect.mockResolvedValueOnce('p1').mockResolvedValueOnce('r1');
    const { ctx } = makeCtx('local');

    await handleFactoryCommand(ctx, ['connect']);

    expect(platform.fetchPlatformProjects).toHaveBeenCalledWith({ token: 'tok', orgId: 'org_only' });
    expect(store.settings.factory).toMatchObject({ orgId: 'org_only', projectRepositoryId: 'r1' });
  });
});
