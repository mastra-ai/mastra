import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
  showFormattedError: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('../display.js', () => ({
  showError: mocks.showError,
  showInfo: mocks.showInfo,
  showFormattedError: mocks.showFormattedError,
  notify: mocks.notify,
}));

vi.mock('../setup.js', () => ({
  buildLayout: vi.fn(),
  setupAutocomplete: vi.fn(),
  loadCustomSlashCommands: vi.fn(async () => {}),
  refreshSkillsAutocomplete: vi.fn(async () => {}),
  setupKeyHandlers: vi.fn(() => () => {}),
  subscribeToAgentController: vi.fn(),
  renderExistingTasks: vi.fn(async () => {}),
}));

vi.mock('../thread-startup.js', () => ({
  resumeThreadOnStartup: vi.fn(async () => undefined),
}));

vi.mock('../thread-title.js', () => ({
  setCurrentThreadTitle: vi.fn(),
}));

import { AssistantRenderRegistry } from '../assistant-render-registry.js';
import { MastraTUI } from '../mastra-tui.js';

type InitTui = {
  state: Record<string, any>;
  statusTimingTimer: ReturnType<typeof setInterval> | null;
  updateCheckTimer: ReturnType<typeof setInterval> | null;
  caffeinateProcess: null;
  syncThreadActivePackMetadata: () => Promise<void>;
  renderExistingMessagesAndSeedIdleCounter: () => Promise<void>;
  shouldShowOnboarding: () => boolean;
  checkForUpdate: ReturnType<typeof vi.fn>;
  init: () => Promise<void>;
  stop: () => void;
};

function createInitTui(onRender: (tui: InitTui) => void = () => {}) {
  const tui = Object.create(MastraTUI.prototype) as InitTui;
  const pluginManager = {
    onReload: vi.fn(() => () => {}),
    onGithubPluginsUpdated: vi.fn(() => () => {}),
    onPluginError: vi.fn(() => () => {}),
  };
  tui.state = {
    isInitialized: false,
    options: {},
    pluginManager,
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
  tui.syncThreadActivePackMetadata = async () => {};
  tui.renderExistingMessagesAndSeedIdleCounter = async () => onRender(tui);
  tui.shouldShowOnboarding = () => false;
  tui.checkForUpdate = vi.fn(async () => {});
  return { tui, pluginManager };
}

describe('MastraTUI init after stop', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mockFn => mockFn.mockReset());
  });

  it('subscribes to plugin errors once the startup thread has rendered', async () => {
    const { tui, pluginManager } = createInitTui();

    await tui.init();

    expect(pluginManager.onPluginError).toHaveBeenCalledTimes(1);
    expect(tui.updateCheckTimer).not.toBeNull();
    tui.stop();
    expect(tui.updateCheckTimer).toBeNull();
  });

  it('does not subscribe or start update checks when stopped while the startup thread renders', async () => {
    const { tui, pluginManager } = createInitTui(stopping => stopping.stop());

    await tui.init();
    const leakedTimer = tui.updateCheckTimer;
    if (leakedTimer) clearInterval(leakedTimer);

    expect(pluginManager.onPluginError).not.toHaveBeenCalled();
    expect(tui.checkForUpdate).not.toHaveBeenCalled();
    expect(leakedTimer).toBeNull();
  });
});
