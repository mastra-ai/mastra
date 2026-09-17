import { beforeEach, describe, expect, it, vi } from 'vitest';

const { askModalQuestion, loadSettings, saveSettings } = vi.hoisted(() => ({
  askModalQuestion: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('@mariozechner/pi-tui', () => ({
  matchesKey: vi.fn(() => false),
  Key: {},
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings,
  saveSettings,
}));

vi.mock('../../modal-question.js', () => ({ askModalQuestion }));

import { handleSubagentsCommand } from '../subagents.js';

function createCtx(subagents: unknown[] = []) {
  return {
    state: {
      session: { subagents: { model: {} } },
      controller: { config: { subagents } },
      ui: { requestRender: vi.fn() },
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as any;
}

function createSettings(subagentsEnabled = false) {
  return {
    preferences: { subagentsEnabled },
    models: { subagentModels: {} },
  } as any;
}

describe('handleSubagentsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSettings.mockReturnValue(createSettings());
  });

  it('enables subagents globally and asks for a restart', async () => {
    const settings = createSettings(false);
    loadSettings.mockReturnValue(settings);
    askModalQuestion.mockResolvedValue('Enable subagents');
    const ctx = createCtx();

    await handleSubagentsCommand(ctx);

    expect(askModalQuestion).toHaveBeenCalledWith(
      ctx.state.ui,
      expect.objectContaining({ allowCustomResponse: false }),
    );
    expect(settings.preferences.subagentsEnabled).toBe(true);
    expect(saveSettings).toHaveBeenCalledWith(settings);
    expect(ctx.showInfo).toHaveBeenCalledWith('Subagents enabled. Restart MastraCode for this to take effect.');
  });

  it('disables subagents globally and asks for a restart', async () => {
    const settings = createSettings(true);
    loadSettings.mockReturnValue(settings);
    askModalQuestion.mockResolvedValue('Disable subagents');
    const ctx = createCtx();

    await handleSubagentsCommand(ctx);

    expect(settings.preferences.subagentsEnabled).toBe(false);
    expect(saveSettings).toHaveBeenCalledWith(settings);
    expect(ctx.showInfo).toHaveBeenCalledWith('Subagents disabled. Restart MastraCode for this to take effect.');
  });

  it('uses built-in types when configuring models without explicit subagents', async () => {
    askModalQuestion.mockResolvedValueOnce('Configure models').mockResolvedValueOnce(null);
    const ctx = createCtx();

    await handleSubagentsCommand(ctx);

    expect(askModalQuestion).toHaveBeenNthCalledWith(
      2,
      ctx.state.ui,
      expect.objectContaining({
        question: 'Select subagent type',
        allowCustomResponse: false,
        options: expect.arrayContaining([
          expect.objectContaining({ label: 'Explore' }),
          expect.objectContaining({ label: 'Plan' }),
          expect.objectContaining({ label: 'Execute' }),
        ]),
      }),
    );
  });

  it('uses configured subagent types when configuring models', async () => {
    askModalQuestion.mockResolvedValueOnce('Configure models').mockResolvedValueOnce(null);
    const ctx = createCtx([{ id: 'custom', name: 'Custom agent', description: 'Custom desc' }]);

    await handleSubagentsCommand(ctx);

    expect(askModalQuestion).toHaveBeenNthCalledWith(
      2,
      ctx.state.ui,
      expect.objectContaining({
        allowCustomResponse: false,
        options: [expect.objectContaining({ label: 'Custom agent', description: 'Custom desc' })],
      }),
    );
  });
});
