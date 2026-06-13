import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrowserSettings } from '../../../onboarding/settings.js';
import { handleBrowserCommand } from '../browser.js';
import type { SlashCommandContext } from '../types.js';

const browserMocks = vi.hoisted(() => ({
  checkProfileProviderMismatch: vi.fn(),
  createBrowserFromSettings: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  setProfileProvider: vi.fn(),
  askModalQuestion: vi.fn(),
}));

vi.mock('../../../onboarding/settings.js', () => ({
  checkProfileProviderMismatch: browserMocks.checkProfileProviderMismatch,
  createBrowserFromSettings: browserMocks.createBrowserFromSettings,
  loadSettings: browserMocks.loadSettings,
  saveSettings: browserMocks.saveSettings,
  setProfileProvider: browserMocks.setProfileProvider,
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: browserMocks.askModalQuestion,
}));

function createContext() {
  const browserInstance = { id: 'browser-instance' };
  const staticAgent = { setBrowser: vi.fn() };
  const dynamicAgent = { setBrowser: vi.fn() };
  const harnessState = { mode: 'review' };
  const setState = vi.fn();
  const browserSettings: BrowserSettings = {
    enabled: false,
    provider: 'stagehand',
    headless: true,
    viewport: { width: 1280, height: 720 },
    profile: '/tmp/mastracode-browser-profile',
    stagehand: { env: 'LOCAL' },
  };
  const settings = {
    browser: browserSettings,
  };
  const ctx = {
    state: {
      harness: {
        getState: vi.fn(() => harnessState),
      },
      ui: {},
    },
    harness: {
      getState: vi.fn(() => harnessState),
      listModes: vi.fn(() => [
        { id: 'build', agent: staticAgent },
        { id: 'review', agent: vi.fn(() => dynamicAgent) },
      ]),
      setState,
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, settings, browserInstance, staticAgent, dynamicAgent, harnessState, setState };
}

describe('handleBrowserCommand', () => {
  beforeEach(() => {
    browserMocks.checkProfileProviderMismatch.mockReset();
    browserMocks.createBrowserFromSettings.mockReset();
    browserMocks.loadSettings.mockReset();
    browserMocks.saveSettings.mockReset();
    browserMocks.setProfileProvider.mockReset();
    browserMocks.askModalQuestion.mockReset();
  });

  it('enables browser settings, attaches the browser to all mode agents, and records active settings', async () => {
    const { ctx, settings, browserInstance, staticAgent, dynamicAgent, harnessState, setState } = createContext();
    browserMocks.loadSettings.mockReturnValue(settings);
    browserMocks.checkProfileProviderMismatch.mockReturnValue(undefined);
    browserMocks.createBrowserFromSettings.mockResolvedValue(browserInstance);

    await handleBrowserCommand(ctx, ['on']);

    const enabledSettings = {
      ...settings.browser,
      enabled: true,
    };
    expect(browserMocks.createBrowserFromSettings).toHaveBeenCalledWith(enabledSettings);
    expect(ctx.harness.listModes).toHaveBeenCalledOnce();
    expect(ctx.state.harness.getState).toHaveBeenCalledOnce();
    expect(staticAgent.setBrowser).toHaveBeenCalledWith(browserInstance);
    expect(dynamicAgent.setBrowser).toHaveBeenCalledWith(browserInstance);
    const dynamicMode = (ctx.harness.listModes as ReturnType<typeof vi.fn>).mock.results[0]?.value[1];
    expect(dynamicMode.agent).toHaveBeenCalledWith(harnessState);
    expect(setState).toHaveBeenCalledWith({ activeBrowserSettings: enabledSettings });
    expect(browserMocks.setProfileProvider).toHaveBeenCalledWith('/tmp/mastracode-browser-profile', 'stagehand');
    expect(browserMocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(settings.browser.enabled).toBe(true);
    expect(ctx.showInfo).toHaveBeenCalledWith('Browser enabled (Stagehand).');
  });

  it('shows active and pending browser status with profile, executable, and storage state drift', async () => {
    const { ctx, settings, harnessState } = createContext();
    settings.browser = {
      enabled: true,
      provider: 'agent-browser',
      headless: false,
      viewport: { width: 1280, height: 720 },
      executablePath: '/Applications/Pending Browser.app/Contents/MacOS/Pending Browser',
      profile: '/tmp/pending-browser-profile',
      agentBrowser: { storageState: '/tmp/pending-storage-state.json' },
    };
    Object.assign(harnessState, {
      activeBrowserSettings: {
        enabled: true,
        provider: 'agent-browser',
        headless: true,
        viewport: { width: 1280, height: 720 },
        executablePath: '/Applications/Active Browser.app/Contents/MacOS/Active Browser',
        profile: '/tmp/active-browser-profile',
        agentBrowser: { storageState: '/tmp/active-storage-state.json' },
      },
    });
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['status']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      [
        'Browser (active):',
        '  Provider: AgentBrowser (deterministic)',
        '  Headless: yes',
        '  Executable: /Applications/Active Browser.app/Contents/MacOS/Active Browser',
        '  Profile: /tmp/active-browser-profile',
        '  Storage State: /tmp/active-storage-state.json',
        '',
        'Pending changes (not yet applied):',
        '  Provider: AgentBrowser (deterministic)',
        '  Headless: no',
        '  Executable: /Applications/Pending Browser.app/Contents/MacOS/Pending Browser',
        '  Profile: /tmp/pending-browser-profile',
        '  Storage State: /tmp/pending-storage-state.json',
        '',
        '⚠️  /browser on to apply, /browser to reconfigure, or restart.',
      ].join('\n'),
    );
  });

  it('treats storage state changes as browser config drift', async () => {
    const { ctx, settings, harnessState } = createContext();
    const activeBrowserSettings: BrowserSettings = {
      enabled: true,
      provider: 'agent-browser',
      headless: false,
      viewport: { width: 1280, height: 720 },
      profile: '/tmp/shared-browser-profile',
      agentBrowser: { storageState: '/tmp/active-storage-state.json' },
    };
    settings.browser = {
      ...activeBrowserSettings,
      agentBrowser: { storageState: '/tmp/pending-storage-state.json' },
    };
    Object.assign(harnessState, { activeBrowserSettings });
    browserMocks.loadSettings.mockReturnValue(settings);

    await handleBrowserCommand(ctx, ['status']);

    const status = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(status).toContain('Browser (active):');
    expect(status).toContain('  Storage State: /tmp/active-storage-state.json');
    expect(status).toContain('Pending changes (not yet applied):');
    expect(status).toContain('  Storage State: /tmp/pending-storage-state.json');
  });
});
