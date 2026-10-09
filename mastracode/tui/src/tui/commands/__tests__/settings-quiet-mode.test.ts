import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  config: null as any,
  callbacks: null as any,
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
}));

vi.mock('../../components/settings.js', () => ({
  SettingsComponent: class {
    focused = false;
    constructor(config: unknown, callbacks: unknown) {
      mocks.config = config;
      mocks.callbacks = callbacks;
    }
  },
}));

vi.mock('../../overlay.js', () => ({ showModalOverlay: vi.fn() }));
vi.mock('../../modal-question.js', () => ({ askModalQuestion: vi.fn() }));
vi.mock('../api-keys.js', () => ({ handleApiKeysCommand: vi.fn() }));

import { NotificationSummaryComponent } from '../../components/notification-summary.js';
import { NotificationComponent } from '../../components/notification.js';
import { handleSettingsCommand } from '../settings.js';

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function createSettings() {
  return {
    onboarding: {},
    preferences: { thinkingLevel: 'off', previewLines: 2, webSearchProvider: 'auto' },
    storage: { backend: 'libsql', libsql: {}, pg: {} },
    signals: { experimentalGithubSignals: false, experimentalCrossAgentSignals: false },
    experimentalAgent: null,
    backgroundTools: { enabled: false },
  };
}

function createCtx() {
  const tool = { setQuietPreviewLineLimit: vi.fn(), setCompactToolModeColor: vi.fn() };
  const notification = new NotificationComponent({
    message: ['line one', 'line two', 'line three', 'line four'].join('\n'),
    source: 'github',
    priority: 'high',
    kind: 'ci-status',
    status: 'delivered',
    quietPreviewLineLimit: 2,
  });
  const summary = new NotificationSummaryComponent({
    message: '2 pending notifications',
    pending: 2,
    bySource: { github: 2 },
  });
  const ctx = {
    state: {
      ui: { requestRender: vi.fn(), hideOverlay: vi.fn() },
      previewLines: 2,
      allToolComponents: [tool],
      messageComponentsById: new Map<string, unknown>([
        ['notification-1', notification],
        ['summary-1', summary],
      ]),
      editor: { escapeEnabled: false },
      session: {
        state: { get: () => ({}) },
        model: { get: () => 'openai/gpt-5' },
        mode: { resolve: () => ({ metadata: {} }) },
      },
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
    stop: vi.fn(),
  } as any;
  return { ctx, tool, notification, summary };
}

describe('/settings preview lines callbacks', () => {
  beforeEach(() => {
    mocks.config = null;
    mocks.callbacks = null;
    mocks.loadSettings.mockReset();
    mocks.saveSettings.mockReset();
    mocks.loadSettings.mockImplementation(() => createSettings());
  });

  it('narrows an invalid persisted experimental agent value for the settings UI', () => {
    mocks.loadSettings.mockReturnValue({ ...createSettings(), experimentalAgent: { invalid: true } });

    void handleSettingsCommand(createCtx().ctx);

    expect(mocks.config).toEqual(expect.objectContaining({ experimentalAgent: null }));
  });

  it('persists the experimental agent selection', () => {
    const { ctx } = createCtx();
    void handleSettingsCommand(ctx);

    mocks.callbacks.onExperimentalAgentChange('evented');

    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ experimentalAgent: 'evented' }));
    expect(ctx.showInfo).toHaveBeenCalledWith('Experimental agent: evented (restart required)');
  });

  it('persists Preview lines and applies it to rendered tools and notifications without changing display mode', async () => {
    const { ctx, tool, notification } = createCtx();
    void handleSettingsCommand(ctx);
    expect(mocks.config).toEqual(expect.objectContaining({ previewLines: 2 }));
    expect(stripAnsi(notification.render(80).join('\n'))).toContain('line two…');

    mocks.callbacks.onPreviewLinesChange(3);

    expect(mocks.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: expect.objectContaining({ previewLines: 3 }) }),
    );
    expect(ctx.state.previewLines).toBe(3);
    expect(tool.setQuietPreviewLineLimit).toHaveBeenLastCalledWith(3);
    const rendered = stripAnsi(notification.render(80).join('\n'));
    expect(rendered).toContain('line three…');
    expect(rendered).not.toContain('line four');
  });
});
