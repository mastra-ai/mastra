import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  callbacks: null as any,
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  saveSettings: mocks.saveSettings,
}));

vi.mock('../../components/settings.js', () => ({
  SettingsComponent: class {
    focused = false;
    constructor(_config: unknown, callbacks: unknown) {
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
    onboarding: { quietModePreferenceSelected: true },
    preferences: { thinkingLevel: 'off', quietMode: false, quietModeMaxToolPreviewLines: 2, webSearchProvider: 'auto' },
    storage: { backend: 'libsql', libsql: {}, pg: {} },
    signals: { experimentalGithubSignals: false, experimentalCrossAgentSignals: false },
  };
}

function createCtx() {
  const tool = { setQuietModeDisplay: vi.fn(), setQuietPreviewLineLimit: vi.fn(), setCompactToolModeColor: vi.fn() };
  const notification = new NotificationComponent({
    message: ['line one', 'line two', 'line three', 'line four'].join('\n'),
    source: 'github',
    priority: 'high',
    kind: 'ci-status',
    status: 'delivered',
  });
  const summary = new NotificationSummaryComponent({
    message: '2 pending notifications',
    pending: 2,
    bySource: { github: 2 },
    byPriority: { high: 2 },
    notificationIds: ['a', 'b'],
  });
  const ctx = {
    state: {
      ui: { requestRender: vi.fn(), hideOverlay: vi.fn() },
      quietMode: false,
      quietModeMaxToolPreviewLines: 2,
      taskProgress: { setQuietMode: vi.fn() },
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

describe('/settings quiet mode callbacks', () => {
  beforeEach(() => {
    mocks.callbacks = null;
    mocks.loadSettings.mockReset();
    mocks.saveSettings.mockReset();
    mocks.loadSettings.mockImplementation(() => createSettings());
  });

  it('applies the quiet toggle to rendered tools, notifications, and summaries', async () => {
    const { ctx, tool, notification, summary } = createCtx();
    void handleSettingsCommand(ctx);
    expect(mocks.callbacks).not.toBeNull();

    const before = stripAnsi(notification.render(80).join('\n'));
    expect(before).toContain('high · ci-status · delivered');
    expect(before).toContain('line four');

    mocks.callbacks.onQuietModeChange(true);

    expect(ctx.state.quietMode).toBe(true);
    expect(tool.setQuietModeDisplay).toHaveBeenCalledWith('quiet');
    const quiet = stripAnsi(notification.render(80).join('\n'));
    expect(quiet).not.toContain('high · ci-status · delivered');
    expect(quiet).toContain('line two…');
    expect(quiet).not.toContain('line three');
    expect(stripAnsi(summary.render(80).join('\n'))).not.toContain('notification_inbox');

    mocks.callbacks.onQuietModeChange(false);

    expect(tool.setQuietModeDisplay).toHaveBeenLastCalledWith('normal');
    const restored = stripAnsi(notification.render(80).join('\n'));
    expect(restored).toContain('high · ci-status · delivered');
    expect(restored).toContain('line four');
    expect(stripAnsi(summary.render(80).join('\n'))).toContain('notification_inbox');
  });

  it('applies the preview line limit to rendered notifications', async () => {
    const { ctx, tool, notification } = createCtx();
    void handleSettingsCommand(ctx);
    mocks.callbacks.onQuietModeChange(true);

    mocks.callbacks.onQuietModeMaxToolPreviewLinesChange(3);

    expect(ctx.state.quietModeMaxToolPreviewLines).toBe(3);
    expect(tool.setQuietPreviewLineLimit).toHaveBeenLastCalledWith(3);
    const rendered = stripAnsi(notification.render(80).join('\n'));
    expect(rendered).toContain('line three…');
    expect(rendered).not.toContain('line four');
  });
});
