import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  askModalQuestion: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('../modal-question.js', () => ({
  askModalQuestion: mocks.askModalQuestion,
}));

vi.mock('../../onboarding/index.js', () => ({
  OnboardingInlineComponent: class {},
  getAvailableModePacks: vi.fn(() => []),
  getAvailableOmPacks: vi.fn(() => []),
  ONBOARDING_VERSION: 1,
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
}));

import type { GlobalSettings } from '../../onboarding/settings.js';
import { MastraTUI } from '../mastra-tui.js';

function createSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    onboarding: {
      completedAt: '2026-01-01T00:00:00.000Z',
      skippedAt: null,
      version: 1,
      modePackId: null,
      omPackId: null,
      quietModePreferenceSelected: true,
      ...overrides.onboarding,
    },
    models: {
      activeModelPackId: null,
      modeDefaults: {},
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
      omObservationThreshold: null,
      omReflectionThreshold: null,
      omCavemanObservations: null,
      subagentModels: {},
      goalJudgeModel: null,
      goalMaxTurns: null,
    },
    preferences: {
      yolo: null,
      theme: 'auto',
      thinkingLevel: 'off',
      quietMode: false,
      quietModeMaxToolPreviewLines: 2,
      ...overrides.preferences,
    },
    storage: { backend: 'libsql', libsql: {}, pg: {} },
    customModelPacks: [],
    customProviders: [],
    modelUseCounts: {},
    updateDismissedVersion: null,
    memoryGateway: {},
    lsp: {},
    browser: {
      enabled: false,
      provider: 'stagehand',
      headless: false,
      viewport: { width: 1280, height: 720 },
      stagehand: { env: 'LOCAL' },
    },
    observability: { resources: {}, localTracing: false },
    ...overrides,
  };
}

function createBareTui() {
  const tool = {
    setQuietModeDisplay: vi.fn(),
    setQuietPreviewLineLimit: vi.fn(),
  };
  const tui = Object.create(MastraTUI.prototype) as any;
  tui.state = {
    ui: { requestRender: vi.fn() },
    quietMode: false,
    quietModeMaxToolPreviewLines: 2,
    taskProgress: { setQuietMode: vi.fn() },
    allToolComponents: [tool],
  };
  return { tui, tool };
}

describe('MastraTUI quiet mode preference prompt', () => {
  beforeEach(() => {
    mocks.askModalQuestion.mockReset();
    mocks.loadSettings.mockReset();
    mocks.saveSettings.mockReset();
  });

  it('does not prompt when the quiet mode preference is already selected', async () => {
    const { tui } = createBareTui();
    mocks.loadSettings.mockReturnValue(createSettings());

    await tui.showQuietModePreferencePromptIfNeeded();

    expect(mocks.askModalQuestion).not.toHaveBeenCalled();
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });

  it('enables quiet mode and marks the preference selected when accepted', async () => {
    const settings = createSettings({
      onboarding: { quietModePreferenceSelected: false } as GlobalSettings['onboarding'],
    });
    const { tui, tool } = createBareTui();
    mocks.loadSettings.mockReturnValue(settings);
    mocks.askModalQuestion.mockResolvedValueOnce('Enable quiet mode').mockResolvedValueOnce('4 lines');

    await tui.showQuietModePreferencePromptIfNeeded();

    expect(mocks.askModalQuestion).toHaveBeenCalledTimes(2);
    expect(settings.preferences.quietMode).toBe(true);
    expect(settings.preferences.quietModeMaxToolPreviewLines).toBe(4);
    expect(settings.onboarding.quietModePreferenceSelected).toBe(true);
    expect(tui.state.quietMode).toBe(true);
    expect(tui.state.quietModeMaxToolPreviewLines).toBe(4);
    expect(tui.state.taskProgress.setQuietMode).toHaveBeenCalledWith(true);
    expect(tool.setQuietModeDisplay).toHaveBeenCalledWith('quiet');
    expect(tool.setQuietPreviewLineLimit).toHaveBeenCalledWith(4);
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
  });

  it('keeps classic mode and marks the preference selected when declined', async () => {
    const settings = createSettings({
      onboarding: { quietModePreferenceSelected: false } as GlobalSettings['onboarding'],
    });
    const { tui, tool } = createBareTui();
    mocks.loadSettings.mockReturnValue(settings);
    mocks.askModalQuestion.mockResolvedValue('Keep classic mode');

    await tui.showQuietModePreferencePromptIfNeeded();

    expect(settings.preferences.quietMode).toBe(false);
    expect(settings.onboarding.quietModePreferenceSelected).toBe(true);
    expect(tui.state.quietMode).toBe(false);
    expect(tool.setQuietModeDisplay).toHaveBeenCalledWith('normal');
    expect(mocks.askModalQuestion).toHaveBeenCalledTimes(1);
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
  });
});
