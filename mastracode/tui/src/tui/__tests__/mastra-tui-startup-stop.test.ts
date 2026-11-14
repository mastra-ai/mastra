import { MODEL_FALLBACK_STATE_KEY } from '@mastra/code-sdk/auth/account-rotation-processor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  current: { stopAt: '' as string, tui: undefined as undefined | { stop: () => void } },
  buildLayout: vi.fn(),
  setupKeyHandlers: vi.fn(() => () => {}),
  subscribeToAgentController: vi.fn(),
  applyCurrentThreadPack: vi.fn(),
  saveSettings: vi.fn(),
  renderExistingTasks: vi.fn(),
  setCurrentThreadTitle: vi.fn(),
  showInfo: vi.fn(),
  resumeThreadOnStartup: vi.fn(),
}));

function stopIfAt(stage: string): void {
  if (mocks.current.stopAt === stage) mocks.current.tui?.stop();
}

vi.mock('../display.js', () => ({
  showError: vi.fn(),
  showInfo: mocks.showInfo,
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
  renderExistingTasks: async (...args: unknown[]) => {
    mocks.renderExistingTasks(...args);
    stopIfAt('tasks');
  },
}));

vi.mock('../thread-startup.js', () => ({
  resumeThreadOnStartup: async (...args: unknown[]) => {
    mocks.resumeThreadOnStartup(...args);
    stopIfAt('resume');
    return undefined;
  },
}));

vi.mock('../render-messages.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../render-messages.js')>()),
  renderExistingMessages: vi.fn(async () => stopIfAt('messages')),
}));

vi.mock('../thread-title.js', () => ({
  setCurrentThreadTitle: (...args: unknown[]) => {
    mocks.setCurrentThreadTitle(...args);
    stopIfAt('thread-state');
  },
}));

vi.mock('../model-packs/apply.js', () => ({
  applyCurrentThreadPack: async (...args: unknown[]) => {
    mocks.applyCurrentThreadPack(...args);
    stopIfAt('pack-apply');
  },
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
  syncThreadActivePackMetadata: ReturnType<typeof vi.fn>;
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
  const startWorkers = vi.fn(async () => stopIfAt('start-workers'));

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
        getMastra: () => ({ startWorkers }),
        loadOMProgress: vi.fn(async () => stopIfAt('om-progress')),
      },
      session: {},
    },
    pluginManager,
    mcpManager,
    hookManager,
    goalManager: {
      loadFromThread: vi.fn(async () => {}),
      getGoal: () => undefined,
      loadFromThreadMetadata: vi.fn(),
    },
    assistantRenderRegistry: new AssistantRenderRegistry(),
    editor: {},
    ui: { start: vi.fn(), stop: vi.fn(), requestRender: vi.fn() },
    session: {
      mode: { get: () => 'build' },
      thread: {
        getId: () => '',
        list: vi.fn(async () => {
          stopIfAt('thread-list');
          return [];
        }),
        listMessages: vi.fn(async () => {
          stopIfAt('resumed-check');
          return [{ id: 'message-1' }];
        }),
      },
      state: { get: () => ({}) },
    },
  };
  tui.statusTimingTimer = null;
  tui.updateCheckTimer = null;
  tui.caffeinateProcess = null;
  tui.queuedUserInput = [];
  tui.syncThreadActivePackMetadata = vi.fn(async () => stopIfAt('pack-metadata'));
  tui.renderExistingMessagesAndSeedIdleCounter = async () => stopIfAt('render');
  tui.shouldShowOnboarding = () => true;
  tui.showOnboarding = vi.fn(async () => stopIfAt('onboarding'));
  tui.checkForUpdate = vi.fn(async () => {});
  tui.submitUserInput = vi.fn(async () => {});
  tui.getUserInput = vi.fn(() => new Promise<string>(() => {}));

  return { tui, pluginManager, mcpManager, backgroundCompletionEvents, hookManager, exit, startWorkers };
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
    const { tui, pluginManager, mcpManager, backgroundCompletionEvents, hookManager, startWorkers } =
      createStartupTui('');

    const running = tui.run();
    await vi.waitFor(() => expect(tui.getUserInput).toHaveBeenCalled());

    expect(startWorkers).toHaveBeenCalledTimes(1);
    expect(pluginManager.onPluginError).toHaveBeenCalledTimes(1);
    expect(tui.state.ui.start).toHaveBeenCalledTimes(1);
    expect(mocks.applyCurrentThreadPack).toHaveBeenCalledTimes(1);
    expect(tui.syncThreadActivePackMetadata).toHaveBeenCalledTimes(1);
    expect(mocks.subscribeToAgentController).toHaveBeenCalledTimes(1);
    expect(backgroundCompletionEvents.subscribe).toHaveBeenCalledTimes(1);
    expect(mocks.setCurrentThreadTitle).toHaveBeenCalledTimes(1);
    expect(mcpManager.initInBackground).toHaveBeenCalledTimes(1);
    expect(mocks.renderExistingTasks).toHaveBeenCalledTimes(1);
    expect(tui.showOnboarding).toHaveBeenCalledTimes(1);
    expect(tui.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(tui.updateCheckTimer).not.toBeNull();
    expect(hookManager.runSessionStart).toHaveBeenCalledTimes(1);
    expect(tui.submitUserInput).toHaveBeenCalledWith('hello');

    tui.stop();
    expect(tui.updateCheckTimer).toBeNull();
    void running;
  });

  it('does not start workers when stopped while the controller initializes', async () => {
    const { tui, startWorkers } = createStartupTui('controller-init');

    await initAndCollectTimer(tui);

    expect(startWorkers).not.toHaveBeenCalled();
  });

  it('does not subscribe to the plugin manager when stopped while workers start', async () => {
    const { tui, pluginManager } = createStartupTui('start-workers');

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

  it('does not sync the thread pack when stopped while the startup pack applies', async () => {
    const { tui } = createStartupTui('pack-apply');

    await initAndCollectTimer(tui);

    expect(tui.syncThreadActivePackMetadata).not.toHaveBeenCalled();
  });

  it('does not apply the thread pack when stopped while the pack sync reads threads', async () => {
    const { tui } = createStartupTui('thread-list');
    delete (tui as Partial<StartupTui>).syncThreadActivePackMetadata;
    tui.state.options.initialPackId = undefined;
    tui.state.options.initialModelOverride = true;
    tui.state.session.thread.getId = () => 'thread-1';

    await initAndCollectTimer(tui);

    expect(tui.state.session.thread.list).toHaveBeenCalledTimes(1);
    expect(mocks.applyCurrentThreadPack).not.toHaveBeenCalled();
  });

  it('does not subscribe to controller or background events when stopped while the pack syncs', async () => {
    const { tui, backgroundCompletionEvents } = createStartupTui('pack-metadata');

    await initAndCollectTimer(tui);

    expect(mocks.subscribeToAgentController).not.toHaveBeenCalled();
    expect(backgroundCompletionEvents.subscribe).not.toHaveBeenCalled();
  });

  it('does not sync the initial thread state when stopped while memory progress loads', async () => {
    const { tui } = createStartupTui('om-progress');

    await initAndCollectTimer(tui);

    expect(mocks.setCurrentThreadTitle).not.toHaveBeenCalled();
  });

  it('does not connect MCP servers when stopped while the initial thread state syncs', async () => {
    const { tui, mcpManager } = createStartupTui('thread-state');

    await initAndCollectTimer(tui);

    expect(mcpManager.initInBackground).not.toHaveBeenCalled();
  });

  it('does not render tasks when stopped while messages render', async () => {
    const { tui } = createStartupTui('render');

    await initAndCollectTimer(tui);

    expect(mocks.renderExistingTasks).not.toHaveBeenCalled();
  });

  it('does not start the idle status timer when stopped while existing messages render', async () => {
    const { tui } = createStartupTui('messages');
    delete (tui as Partial<StartupTui>).renderExistingMessagesAndSeedIdleCounter;
    tui.state.session.run = { isRunning: () => false };
    tui.state.lastRenderedMessageAt = Date.now();

    await initAndCollectTimer(tui);
    const statusTimer = tui.statusTimingTimer;
    if (statusTimer) clearInterval(statusTimer);

    expect(statusTimer).toBeNull();
  });

  it('does not persist fallback state or set the title when stopped while the initial thread state reads threads', async () => {
    const { tui } = createStartupTui('thread-list');
    tui.state.session.thread.getId = () => 'thread-1';
    tui.state.session.state = {
      get: () => ({ [MODEL_FALLBACK_STATE_KEY]: { toModelId: 'model-b' } }),
      setIf: vi.fn(async () => true),
    };

    await initAndCollectTimer(tui);

    expect(tui.state.session.thread.list).toHaveBeenCalledTimes(1);
    expect(tui.state.session.state.setIf).not.toHaveBeenCalled();
    expect(mocks.setCurrentThreadTitle).not.toHaveBeenCalled();
  });

  it('tells the startup thread resume that a stop ended the TUI', async () => {
    const { tui } = createStartupTui('resume');

    await initAndCollectTimer(tui);

    const isCurrent = mocks.resumeThreadOnStartup.mock.calls[0]?.[2] as (() => boolean) | undefined;
    expect(isCurrent?.()).toBe(false);
  });

  it('does not open onboarding when stopped while tasks render', async () => {
    const { tui } = createStartupTui('tasks');

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

  it('does not wait for typed input when stopped while the initial message is submitted', async () => {
    const { tui } = createStartupTui('');
    tui.submitUserInput = vi.fn(async () => tui.stop());

    const running = tui.run();
    await Promise.race([running, new Promise(resolve => setTimeout(resolve, 50))]);
    const timer = tui.updateCheckTimer;
    if (timer) clearInterval(timer);

    expect(tui.submitUserInput).toHaveBeenCalledWith('hello');
    expect(tui.getUserInput).not.toHaveBeenCalled();
  });

  it('does not show the resume notice or send the initial message when stopped while checking for a resumed conversation', async () => {
    const { tui } = createStartupTui('resumed-check');
    tui.state.options.resumeSkipNotice = 'Resumed; startup prompt skipped.';
    tui.state.session.thread.getId = () => 'thread-1';

    const running = tui.run();
    await Promise.race([running, new Promise(resolve => setTimeout(resolve, 50))]);
    const timer = tui.updateCheckTimer;
    if (timer) clearInterval(timer);

    expect(tui.state.session.thread.listMessages).toHaveBeenCalledTimes(1);
    expect(mocks.showInfo).not.toHaveBeenCalledWith(tui.state, 'Resumed; startup prompt skipped.');
    expect(tui.submitUserInput).not.toHaveBeenCalled();
    expect(tui.getUserInput).not.toHaveBeenCalled();
  });
});
