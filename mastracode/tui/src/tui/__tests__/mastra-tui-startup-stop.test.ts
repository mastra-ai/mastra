import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  current: { stopAt: '' as string, tui: undefined as undefined | { stop: () => void } },
  buildLayout: vi.fn(),
  setupKeyHandlers: vi.fn(() => () => {}),
  subscribeToAgentController: vi.fn(),
  applyCurrentThreadPack: vi.fn(async () => {}),
  saveSettings: vi.fn(),
}));

function stopIfAt(stage: string): void {
  if (mocks.current.stopAt === stage) mocks.current.tui?.stop();
}

vi.mock('../display.js', () => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
  showFormattedError: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../setup.js', () => ({
  buildLayout: mocks.buildLayout,
  setupAutocomplete: vi.fn(),
  loadCustomSlashCommands: vi.fn(async () => stopIfAt('slash-commands')),
  refreshSkillsAutocomplete: vi.fn(async () => {}),
  setupKeyHandlers: mocks.setupKeyHandlers,
  subscribeToAgentController: mocks.subscribeToAgentController,
  renderExistingTasks: vi.fn(async () => {}),
}));

vi.mock('../thread-startup.js', () => ({
  resumeThreadOnStartup: vi.fn(async () => {
    stopIfAt('resume');
    return undefined;
  }),
}));

vi.mock('../thread-title.js', () => ({
  setCurrentThreadTitle: vi.fn(),
}));

vi.mock('../model-packs/apply.js', () => ({
  applyCurrentThreadPack: mocks.applyCurrentThreadPack,
  listResolvableModePacks: vi.fn(() => []),
}));

vi.mock('@mastra/code-sdk/onboarding/pack-activation', () => ({
  resolvePackSelection: vi.fn(() => ({ packId: 'pack-a' })),
  activateModePackInSettings: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/index', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk/onboarding/index')>()),
  loadSettings: vi.fn(() => ({})),
  saveSettings: mocks.saveSettings,
}));

import { AssistantRenderRegistry } from '../assistant-render-registry.js';
import { MastraTUI } from '../mastra-tui.js';

type StartupTui = {
  state: Record<string, any>;
  statusTimingTimer: ReturnType<typeof setInterval> | null;
  updateCheckTimer: ReturnType<typeof setInterval> | null;
  caffeinateProcess: null;
  queuedUserInput: string[];
  syncThreadActivePackMetadata: () => Promise<void>;
  renderExistingMessagesAndSeedIdleCounter: () => Promise<void>;
  shouldShowOnboarding: () => boolean;
  showOnboarding: ReturnType<typeof vi.fn>;
  checkForUpdate: ReturnType<typeof vi.fn>;
  submitUserInput: ReturnType<typeof vi.fn>;
  getUserInput: ReturnType<typeof vi.fn>;
  init: () => Promise<void>;
  run: () => Promise<void>;
  stop: () => void;
};

function createStartupTui(stopAt: string) {
  const tui = Object.create(MastraTUI.prototype) as StartupTui;
  mocks.current.stopAt = stopAt;
  mocks.current.tui = tui;

  const pluginManager = {
    onReload: vi.fn(() => () => {}),
    onGithubPluginsUpdated: vi.fn(() => () => {}),
    onPluginError: vi.fn(() => () => {}),
  };
  const mcpManager = {
    hasServers: () => true,
    initInBackground: vi.fn(async () => ({ connected: [], failed: [], skipped: [], totalTools: 0 })),
  };
  const backgroundCompletionEvents = { subscribe: vi.fn(() => () => {}) };
  const hookManager = {
    runSessionStart: vi.fn(async () => {}),
    runSessionEnd: vi.fn(async () => {}),
  };
  const exit = vi.fn();

  tui.state = {
    isInitialized: false,
    options: {
      initialPackId: 'pack-a',
      backgroundToolsEnabled: true,
      backgroundCompletionEvents,
      initialMessage: 'hello',
      exit,
    },
    local: {
      controller: {
        init: vi.fn(async () => stopIfAt('controller-init')),
        getMastra: () => undefined,
        loadOMProgress: vi.fn(async () => stopIfAt('om-progress')),
      },
      session: {},
    },
    pluginManager,
    mcpManager,
    hookManager,
    assistantRenderRegistry: new AssistantRenderRegistry(),
    editor: {},
    ui: { start: vi.fn(), stop: vi.fn(), requestRender: vi.fn() },
    session: {
      mode: { get: () => 'build' },
      thread: { getId: () => '' },
      state: { get: () => ({}) },
    },
  };
  tui.statusTimingTimer = null;
  tui.updateCheckTimer = null;
  tui.caffeinateProcess = null;
  tui.queuedUserInput = [];
  tui.syncThreadActivePackMetadata = async () => stopIfAt('pack-metadata');
  tui.renderExistingMessagesAndSeedIdleCounter = async () => stopIfAt('render');
  tui.shouldShowOnboarding = () => true;
  tui.showOnboarding = vi.fn(async () => stopIfAt('onboarding'));
  tui.checkForUpdate = vi.fn(async () => {});
  tui.submitUserInput = vi.fn(async () => {});
  tui.getUserInput = vi.fn(() => new Promise<string>(() => {}));

  return { tui, pluginManager, mcpManager, backgroundCompletionEvents, hookManager, exit };
}

async function initAndCollectTimer(tui: StartupTui): Promise<ReturnType<typeof setInterval> | null> {
  await tui.init();
  const timer = tui.updateCheckTimer;
  if (timer) clearInterval(timer);
  return timer;
}

describe('MastraTUI startup stopped part-way', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs every startup step when nothing stops it', async () => {
    const { tui, pluginManager, mcpManager, backgroundCompletionEvents, hookManager } = createStartupTui('');

    const running = tui.run();
    await vi.waitFor(() => expect(tui.getUserInput).toHaveBeenCalled());

    expect(pluginManager.onPluginError).toHaveBeenCalledTimes(1);
    expect(tui.state.ui.start).toHaveBeenCalledTimes(1);
    expect(mocks.applyCurrentThreadPack).toHaveBeenCalledTimes(1);
    expect(mocks.subscribeToAgentController).toHaveBeenCalledTimes(1);
    expect(backgroundCompletionEvents.subscribe).toHaveBeenCalledTimes(1);
    expect(mcpManager.initInBackground).toHaveBeenCalledTimes(1);
    expect(tui.showOnboarding).toHaveBeenCalledTimes(1);
    expect(tui.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(tui.updateCheckTimer).not.toBeNull();
    expect(hookManager.runSessionStart).toHaveBeenCalledTimes(1);
    expect(tui.submitUserInput).toHaveBeenCalledWith('hello');

    tui.stop();
    expect(tui.updateCheckTimer).toBeNull();
    void running;
  });

  it('does not subscribe to the plugin manager when stopped while the controller starts', async () => {
    const { tui, pluginManager } = createStartupTui('controller-init');

    await initAndCollectTimer(tui);

    expect(pluginManager.onReload).not.toHaveBeenCalled();
    expect(pluginManager.onGithubPluginsUpdated).not.toHaveBeenCalled();
    expect(pluginManager.onPluginError).not.toHaveBeenCalled();
  });

  it('does not take the terminal back when stopped while slash commands load', async () => {
    const { tui } = createStartupTui('slash-commands');

    await initAndCollectTimer(tui);

    expect(mocks.buildLayout).not.toHaveBeenCalled();
    expect(mocks.setupKeyHandlers).not.toHaveBeenCalled();
    expect(tui.state.ui.start).not.toHaveBeenCalled();
  });

  it('does not apply or save the startup pack when stopped while the thread resumes', async () => {
    const { tui, exit } = createStartupTui('resume');

    await initAndCollectTimer(tui);

    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.applyCurrentThreadPack).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('does not subscribe to controller or background events when stopped while the pack syncs', async () => {
    const { tui, backgroundCompletionEvents } = createStartupTui('pack-metadata');

    await initAndCollectTimer(tui);

    expect(mocks.subscribeToAgentController).not.toHaveBeenCalled();
    expect(backgroundCompletionEvents.subscribe).not.toHaveBeenCalled();
  });

  it('does not connect MCP servers when stopped while memory progress loads', async () => {
    const { tui, mcpManager } = createStartupTui('om-progress');

    await initAndCollectTimer(tui);

    expect(mcpManager.initInBackground).not.toHaveBeenCalled();
  });

  it('does not open onboarding when stopped while the thread renders', async () => {
    const { tui } = createStartupTui('render');

    await initAndCollectTimer(tui);

    expect(tui.showOnboarding).not.toHaveBeenCalled();
  });

  it('does not check for updates or start the update timer when stopped during onboarding', async () => {
    const { tui } = createStartupTui('onboarding');

    const timer = await initAndCollectTimer(tui);

    expect(tui.checkForUpdate).not.toHaveBeenCalled();
    expect(timer).toBeNull();
  });

  it('does not run SessionStart hooks or send the initial message when stopped during startup', async () => {
    const { tui, hookManager } = createStartupTui('render');

    const running = tui.run();
    await Promise.race([running, new Promise(resolve => setTimeout(resolve, 50))]);
    const timer = tui.updateCheckTimer;
    if (timer) clearInterval(timer);

    expect(hookManager.runSessionStart).not.toHaveBeenCalled();
    expect(tui.submitUserInput).not.toHaveBeenCalled();
    expect(tui.getUserInput).not.toHaveBeenCalled();
  });
});
