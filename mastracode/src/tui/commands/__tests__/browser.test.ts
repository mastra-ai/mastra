import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  createBrowserFromSettings: vi.fn(),
  checkProfileProviderMismatch: vi.fn(() => undefined),
  setProfileProvider: vi.fn(),
}));

vi.mock('../../../onboarding/settings.js', () => settingsMock);

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: vi.fn(),
}));

vi.mock('@mastra/agent-browser', () => ({
  AgentBrowser: class {},
}));

import { handleBrowserCommand } from '../browser.js';

interface MockAgent {
  __setManagedBrowser: ReturnType<typeof vi.fn>;
  setBrowser: ReturnType<typeof vi.fn>;
  hasOwnBrowser: ReturnType<typeof vi.fn>;
}

function makeAgent({ explicit = false }: { explicit?: boolean } = {}): MockAgent {
  let hasExplicit = explicit;
  return {
    setBrowser: vi.fn(() => {
      hasExplicit = true;
    }),
    __setManagedBrowser: vi.fn(),
    hasOwnBrowser: vi.fn(() => hasExplicit),
  };
}

function disabledSettings() {
  return {
    browser: {
      enabled: false,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
    },
  };
}

function enabledSettings() {
  return {
    browser: {
      enabled: true,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
    },
  };
}

function createCtx(modes: Array<{ id: string; agent: unknown }>): {
  ctx: Parameters<typeof handleBrowserCommand>[0];
  state: Record<string, unknown>;
  setStateSpy: ReturnType<typeof vi.fn>;
} {
  const state: Record<string, unknown> = {};
  const setStateSpy = vi.fn((patch: Record<string, unknown>) => Object.assign(state, patch));
  const ctx = {
    showInfo: vi.fn(),
    showError: vi.fn(),
    state: {
      harness: { getState: () => state },
      ui: { requestRender: vi.fn() },
    },
    harness: {
      listModes: () => modes,
      getState: () => state,
      setState: setStateSpy,
      getCurrentMode: () => modes[0],
    },
  } as unknown as Parameters<typeof handleBrowserCommand>[0];
  return { ctx, state, setStateSpy };
}

describe('/browser apply propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.checkProfileProviderMismatch.mockReturnValue(undefined);
    settingsMock.createBrowserFromSettings.mockResolvedValue({ name: 'browser-instance' });
  });

  it('skips agents that already own their browser via the managed setter', async () => {
    const explicitAgent = makeAgent({ explicit: true });
    const managedAgent = makeAgent();
    settingsMock.loadSettings.mockReturnValue(disabledSettings());
    const { ctx } = createCtx([
      { id: 'mode-a', agent: explicitAgent },
      { id: 'mode-b', agent: managedAgent },
    ]);

    await handleBrowserCommand(ctx, ['off']);

    expect(explicitAgent.__setManagedBrowser).toHaveBeenCalledTimes(1);
    expect(explicitAgent.setBrowser).not.toHaveBeenCalled();
    expect(explicitAgent.hasOwnBrowser()).toBe(true);

    expect(managedAgent.__setManagedBrowser).toHaveBeenCalledTimes(1);
    expect(managedAgent.__setManagedBrowser).toHaveBeenCalledWith(undefined);
    expect(managedAgent.hasOwnBrowser()).toBe(false);
  });

  it('deduplicates when the same agent is referenced by multiple modes', async () => {
    const sharedAgent = makeAgent();
    settingsMock.loadSettings.mockReturnValue(disabledSettings());
    const { ctx, setStateSpy } = createCtx([
      { id: 'mode-a', agent: sharedAgent },
      { id: 'mode-b', agent: sharedAgent },
      { id: 'mode-c', agent: sharedAgent },
    ]);

    await handleBrowserCommand(ctx, ['off']);

    expect(sharedAgent.__setManagedBrowser).toHaveBeenCalledTimes(1);
    expect(setStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeBrowserSettings: expect.objectContaining({ enabled: false }) }),
    );
  });

  it('propagates the new browser on /browser on and clears on /browser off', async () => {
    const agent = makeAgent();
    settingsMock.loadSettings.mockReturnValue(enabledSettings());
    const { ctx, setStateSpy } = createCtx([{ id: 'mode-a', agent }]);

    await handleBrowserCommand(ctx, ['on']);
    expect(settingsMock.createBrowserFromSettings).toHaveBeenCalledTimes(1);
    expect(agent.__setManagedBrowser).toHaveBeenLastCalledWith({ name: 'browser-instance' });

    settingsMock.loadSettings.mockReturnValue(disabledSettings());
    await handleBrowserCommand(ctx, ['off']);
    expect(agent.__setManagedBrowser).toHaveBeenLastCalledWith(undefined);

    expect(setStateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeBrowserSettings: expect.objectContaining({ enabled: false }) }),
    );
  });

  it('keeps reaching the agent across /browser on -> off -> on cycles (no self-poisoning)', async () => {
    const agent = makeAgent();
    settingsMock.loadSettings.mockReturnValue(enabledSettings());
    const { ctx } = createCtx([{ id: 'mode-a', agent }]);

    await handleBrowserCommand(ctx, ['on']);
    settingsMock.loadSettings.mockReturnValue(disabledSettings());
    await handleBrowserCommand(ctx, ['off']);
    settingsMock.loadSettings.mockReturnValue(enabledSettings());
    settingsMock.createBrowserFromSettings.mockResolvedValueOnce({ name: 'browser-instance-2' });
    await handleBrowserCommand(ctx, ['on']);

    expect(agent.__setManagedBrowser).toHaveBeenCalledTimes(3);
    expect(agent.__setManagedBrowser).toHaveBeenNthCalledWith(1, { name: 'browser-instance' });
    expect(agent.__setManagedBrowser).toHaveBeenNthCalledWith(2, undefined);
    expect(agent.__setManagedBrowser).toHaveBeenNthCalledWith(3, { name: 'browser-instance-2' });
    expect(agent.hasOwnBrowser()).toBe(false);
  });

  it('deduplicates dynamic-mode agents when the resolver returns a stable instance', async () => {
    const stableAgent = makeAgent();
    settingsMock.loadSettings.mockReturnValue(disabledSettings());
    const { ctx } = createCtx([
      { id: 'mode-a', agent: () => stableAgent },
      { id: 'mode-b', agent: () => stableAgent },
    ]);

    await handleBrowserCommand(ctx, ['off']);

    expect(stableAgent.__setManagedBrowser).toHaveBeenCalledTimes(1);
  });

  it('treats dynamic-mode agents resolved to fresh instances as distinct (no dedupe)', async () => {
    const calls: MockAgent[] = [];
    settingsMock.loadSettings.mockReturnValue(disabledSettings());
    const { ctx } = createCtx([
      {
        id: 'mode-a',
        agent: () => {
          const a = makeAgent();
          calls.push(a);
          return a;
        },
      },
      {
        id: 'mode-b',
        agent: () => {
          const a = makeAgent();
          calls.push(a);
          return a;
        },
      },
    ]);

    await handleBrowserCommand(ctx, ['off']);

    expect(calls).toHaveLength(2);
    expect(calls[0]!.__setManagedBrowser).toHaveBeenCalledTimes(1);
    expect(calls[1]!.__setManagedBrowser).toHaveBeenCalledTimes(1);
  });
});
