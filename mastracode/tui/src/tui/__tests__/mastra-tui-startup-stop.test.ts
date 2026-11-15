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
  OnboardingInlineComponent: vi.fn(),
  promptAuthMode: vi.fn(),
  LoginDialogComponent: vi.fn(),
  ModelSelectorComponent: vi.fn(),
  updateStatusLine: vi.fn(),
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
  loadSettings: vi.fn(() => ({ onboarding: {}, models: {}, preferences: {}, customModelPacks: [] })),
  saveSettings: mocks.saveSettings,
}));

vi.mock('../onboarding-inline.js', () => ({
  OnboardingInlineComponent: mocks.OnboardingInlineComponent,
}));

vi.mock('../overlay.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../overlay.js')>()),
  showModalOverlay: vi.fn(),
}));

vi.mock('../status-line.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../status-line.js')>()),
  updateStatusLine: mocks.updateStatusLine,
}));

vi.mock('../components/login-mode-selector.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../components/login-mode-selector.js')>()),
  promptAuthMode: mocks.promptAuthMode,
}));

vi.mock('../components/login-dialog.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../components/login-dialog.js')>()),
  LoginDialogComponent: mocks.LoginDialogComponent,
}));

vi.mock('../components/model-selector.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../components/model-selector.js')>()),
  ModelSelectorComponent: mocks.ModelSelectorComponent,
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
  pendingUserInputResolve?: (text: string) => void;
  buildProviderAccess: ReturnType<typeof vi.fn>;
  runUserPromptHook: ReturnType<typeof vi.fn>;
  renderOptimisticUserMessage: ReturnType<typeof vi.fn>;
  removeOptimisticUserMessage: ReturnType<typeof vi.fn>;
  refreshModelAuthStatus: ReturnType<typeof vi.fn>;
  applyOnboardingResult: (result: unknown) => Promise<void>;
  performLogin: (providerId: string) => Promise<void>;
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

  it('sends the startup prompt through the real submission when nothing stops it', async () => {
    const { tui } = createStartupTui('');
    useRealPromptSubmission(tui);

    const running = tui.run();
    await vi.waitFor(() => expect(tui.state.session.sendSignal).toHaveBeenCalledTimes(1));
    tui.stop();
    void running;

    expect(tui.runUserPromptHook).toHaveBeenCalledWith('hello');
    expect(tui.state.session.thread.create).toHaveBeenCalledTimes(1);
    expect(tui.state.session.sendSignal).toHaveBeenCalledWith({ content: 'hello' });
  });

  it('does not create a thread or send the startup prompt when stopped while the prompt hook runs', async () => {
    const { tui } = createStartupTui('prompt-hook');
    useRealPromptSubmission(tui);

    await settle(tui.run());
    clearUpdateTimer(tui);

    expect(tui.runUserPromptHook).toHaveBeenCalledWith('hello');
    expect(tui.state.session.thread.create).not.toHaveBeenCalled();
    expect(tui.state.session.sendSignal).not.toHaveBeenCalled();
  });

  it('does not send the startup prompt when stopped while its new thread is created', async () => {
    const { tui } = createStartupTui('thread-create');
    useRealPromptSubmission(tui);

    await settle(tui.run());
    clearUpdateTimer(tui);

    expect(tui.state.session.thread.create).toHaveBeenCalledTimes(1);
    expect(tui.state.session.sendSignal).not.toHaveBeenCalled();
  });

  it('does not open onboarding when stopped while provider access is read', async () => {
    const { tui } = createStartupTui('provider-access');
    delete (tui as Partial<StartupTui>).showOnboarding;
    tui.buildProviderAccess = vi.fn(async () => {
      stopIfAt('provider-access');
      return {};
    });

    await settle(tui.init());
    clearUpdateTimer(tui);

    expect(tui.buildProviderAccess).toHaveBeenCalledTimes(1);
    expect(mocks.OnboardingInlineComponent).not.toHaveBeenCalled();
    expect(tui.state.activeOnboarding).toBeUndefined();
  });

  it('applies a finished onboarding when nothing stops it', async () => {
    const { tui } = createStartupTui('');
    useOnboardingResult(tui);

    await tui.applyOnboardingResult(onboardingResult);

    expect(mocks.saveSettings).toHaveBeenCalledTimes(1);
    expect(mocks.applyCurrentThreadPack).toHaveBeenCalledTimes(1);
    expect(tui.state.session.thread.setSetting).toHaveBeenCalledTimes(1);
    expect(mocks.updateStatusLine).toHaveBeenCalledTimes(1);
    expect(tui.refreshModelAuthStatus).toHaveBeenCalledTimes(1);
  });

  it('does not save settings or apply the pack when stopped while onboarding saves yolo', async () => {
    const { tui } = createStartupTui('onboarding-yolo');
    useOnboardingResult(tui);

    await tui.applyOnboardingResult(onboardingResult);

    expect(tui.state.session.state.set).toHaveBeenCalledTimes(1);
    expect(mocks.saveSettings).not.toHaveBeenCalled();
    expect(mocks.applyCurrentThreadPack).not.toHaveBeenCalled();
  });

  it('does not clear the thread fallback status when stopped while onboarding applies the pack', async () => {
    const { tui } = createStartupTui('pack-apply');
    useOnboardingResult(tui);

    await tui.applyOnboardingResult(onboardingResult);

    expect(mocks.applyCurrentThreadPack).toHaveBeenCalledTimes(1);
    expect(tui.state.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not refresh the status line or model auth when stopped while onboarding clears the fallback status', async () => {
    const { tui } = createStartupTui('fallback-clear');
    useOnboardingResult(tui);
    tui.state.session.thread.setSetting = vi.fn(async () => stopIfAt('fallback-clear'));

    await tui.applyOnboardingResult(onboardingResult);

    expect(tui.state.session.thread.setSetting).toHaveBeenCalledTimes(1);
    expect(mocks.updateStatusLine).not.toHaveBeenCalled();
    expect(tui.refreshModelAuthStatus).not.toHaveBeenCalled();
  });

  it('logs in and switches to the default model when nothing stops it', async () => {
    const { tui } = createStartupTui('');
    useLogin(tui);

    await tui.performLogin('anthropic');

    expect(mocks.LoginDialogComponent).toHaveBeenCalledTimes(1);
    expect(tui.state.authStorage.login).toHaveBeenCalledTimes(1);
    expect(tui.state.session.model.switch).toHaveBeenCalledTimes(1);
  });

  it('does not open the login dialog when stopped while the login mode is chosen', async () => {
    const { tui } = createStartupTui('auth-mode');
    useLogin(tui);

    await tui.performLogin('anthropic');

    expect(mocks.promptAuthMode).toHaveBeenCalledTimes(1);
    expect(mocks.LoginDialogComponent).not.toHaveBeenCalled();
    expect(tui.state.authStorage.login).not.toHaveBeenCalled();
  });

  it('does not switch models or report the login when stopped while logging in', async () => {
    const { tui } = createStartupTui('login');
    useLogin(tui);

    await tui.performLogin('anthropic');

    expect(tui.state.authStorage.login).toHaveBeenCalledTimes(1);
    expect(tui.state.ui.hideOverlay).toHaveBeenCalled();
    expect(tui.state.session.model.switch).not.toHaveBeenCalled();
    expect(mocks.showInfo).not.toHaveBeenCalled();
  });

  it('refreshes provider access after an onboarding login when nothing stops it', async () => {
    const { tui } = createStartupTui('');
    const component = await openRealOnboarding(tui);
    tui.performLogin = vi.fn(async () => {});
    const done = vi.fn();

    component.options.onLogin('anthropic', done);
    await vi.waitFor(() => expect(done).toHaveBeenCalledTimes(1));

    expect(tui.buildProviderAccess).toHaveBeenCalledTimes(2);
    expect(component.updateModePacks).toHaveBeenCalledTimes(1);
  });

  it('does not refresh provider access when stopped during an onboarding login', async () => {
    const { tui } = createStartupTui('');
    const component = await openRealOnboarding(tui);
    tui.performLogin = vi.fn(async () => tui.stop());
    const done = vi.fn();

    component.options.onLogin('anthropic', done);
    await vi.waitFor(() => expect(done).toHaveBeenCalledTimes(1));

    expect(tui.buildProviderAccess).toHaveBeenCalledTimes(1);
    expect(component.updateModePacks).not.toHaveBeenCalled();
    expect(component.updateHasProviderAccess).not.toHaveBeenCalled();
  });

  it('opens the onboarding model selector when nothing stops it', async () => {
    const { tui } = createStartupTui('');
    const component = await openRealOnboarding(tui);

    void component.options.onSelectModel('Build');
    await vi.waitFor(() => expect(mocks.ModelSelectorComponent).toHaveBeenCalledTimes(1));
  });

  it('does not open the onboarding model selector when stopped while models are listed', async () => {
    const { tui } = createStartupTui('model-list');
    const component = await openRealOnboarding(tui);

    const picked = await Promise.race([
      component.options.onSelectModel('Build'),
      new Promise(resolve => setTimeout(() => resolve('still waiting'), 50)),
    ]);

    expect(tui.state.controller.listAvailableModels).toHaveBeenCalledTimes(1);
    expect(mocks.ModelSelectorComponent).not.toHaveBeenCalled();
    expect(picked).toBeUndefined();
  });

  it('detaches the input handler when stopped', async () => {
    const { tui } = createStartupTui('');
    delete (tui as Partial<StartupTui>).getUserInput;

    const running = tui.run();
    await vi.waitFor(() => expect(tui.state.editor.onSubmit).toBeTypeOf('function'));
    tui.stop();
    void running;

    expect(tui.state.editor.onSubmit).toBeUndefined();
    expect(tui.pendingUserInputResolve).toBeUndefined();
  });

  it('does not submit input handed over just before a stop', async () => {
    const { tui } = createStartupTui('');
    delete (tui as Partial<StartupTui>).getUserInput;
    tui.state.editor = { addToHistory: vi.fn(), setText: vi.fn() };
    tui.state.session.run = { isRunning: () => false };

    const running = tui.run();
    await vi.waitFor(() => expect(tui.state.editor.onSubmit).toBeTypeOf('function'));
    tui.state.editor.onSubmit('typed');
    tui.stop();
    await settle(running);

    expect(tui.submitUserInput).toHaveBeenCalledWith('hello');
    expect(tui.submitUserInput).not.toHaveBeenCalledWith('typed');
  });
});

const onboardingResult = { modePack: { id: 'pack-a', models: { build: 'model-a' } }, yolo: false };

function settle(running: Promise<void>): Promise<unknown> {
  return Promise.race([running, new Promise(resolve => setTimeout(resolve, 50))]);
}

function clearUpdateTimer(tui: StartupTui): void {
  const timer = tui.updateCheckTimer;
  if (timer) clearInterval(timer);
}

function useRealPromptSubmission(tui: StartupTui): void {
  delete (tui as Partial<StartupTui>).submitUserInput;
  tui.state.pendingNewThread = true;
  tui.state.pendingImages = [];
  tui.state.messageComponentsById = new Map();
  tui.state.session.model = { hasSelection: () => true };
  tui.state.session.identity = { getResourceId: () => 'resource-1' };
  tui.state.session.thread.create = vi.fn(async () => stopIfAt('thread-create'));
  tui.state.session.sendSignal = vi.fn(() => ({ id: 'signal-1', accepted: Promise.resolve() }));
  tui.renderOptimisticUserMessage = vi.fn(() => 'optimistic-1');
  tui.removeOptimisticUserMessage = vi.fn();
  tui.runUserPromptHook = vi.fn(async () => {
    stopIfAt('prompt-hook');
    return true;
  });
}

function useOnboardingResult(tui: StartupTui): void {
  tui.state.controller = { listModes: () => [{ id: 'build' }] };
  tui.state.session.state = { get: () => ({}), set: vi.fn(async () => stopIfAt('onboarding-yolo')) };
  tui.state.session.thread.setSetting = vi.fn(async () => {});
  tui.refreshModelAuthStatus = vi.fn(async () => {});
}

function useLogin(tui: StartupTui): void {
  tui.state.ui.hideOverlay = vi.fn();
  tui.state.authStorage = { login: vi.fn(async () => stopIfAt('login')), isLoggedIn: () => false };
  tui.state.session.model = { switch: vi.fn(async () => {}) };
  mocks.promptAuthMode.mockImplementation(async () => {
    stopIfAt('auth-mode');
    return 'oauth';
  });
  mocks.LoginDialogComponent.mockImplementation(function () {
    return { signal: undefined, showAuth: vi.fn(), showPrompt: vi.fn(), showProgress: vi.fn() };
  });
}

type OnboardingOptions = {
  onLogin: (providerId: string, done: () => void) => void;
  onSelectModel: (title: string) => Promise<string | undefined>;
};

async function openRealOnboarding(tui: StartupTui) {
  delete (tui as Partial<StartupTui>).showOnboarding;
  tui.buildProviderAccess = vi.fn(async () => ({}));
  tui.state.controller = {
    listAvailableModels: vi.fn(async () => {
      stopIfAt('model-list');
      return [{ id: 'model-a' }];
    }),
  };
  const component = {
    options: undefined as unknown as OnboardingOptions,
    updateModePacks: vi.fn(),
    updateHasProviderAccess: vi.fn(),
  };
  mocks.OnboardingInlineComponent.mockImplementation(function (options: OnboardingOptions) {
    component.options = options;
    return component;
  });
  mocks.ModelSelectorComponent.mockImplementation(function () {
    return {};
  });

  void (tui.showOnboarding as unknown as () => Promise<void>)();
  await vi.waitFor(() => expect(mocks.OnboardingInlineComponent).toHaveBeenCalledTimes(1));
  return component;
}
