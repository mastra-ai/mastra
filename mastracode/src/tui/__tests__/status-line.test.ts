import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const visibleWidthMock = vi.fn((value: string) => value.length);

vi.mock('@mariozechner/pi-tui', () => ({
  visibleWidth: visibleWidthMock,
}));

vi.mock('chalk', () => {
  const passthrough = (value: string) => value;
  const chain = Object.assign((value: string) => value, {
    bold: passthrough,
    hex: () => chain,
    bgHex: () => chain,
    bgRgb: () => chain,
    rgb: () => chain,
  });

  return {
    default: {
      hex: () => chain,
      bgHex: () => chain,
      bgRgb: () => chain,
      rgb: () => chain,
    },
  };
});

vi.mock('../components/obi-loader.js', () => ({
  applyGradientSweep: (value: string) => value,
}));

vi.mock('../components/om-progress.js', () => ({
  formatObservationStatus: vi.fn(() => ''),
  formatReflectionStatus: vi.fn(() => ''),
}));

vi.mock('../theme.js', () => ({
  theme: {
    fg: (_tone: string, value: string) => value,
  },
  mastra: {
    orange: '#f97316',
    pink: '#ec4899',
    purple: '#8b5cf6',
    blue: '#3b82f6',
    specialGray: '#6b7280',
  },
  tintHex: (_color: string, _amount: number) => '#111111',
  getThemeMode: () => 'dark',
}));

import { updateStatusLine } from '../status-line.js';

function createState() {
  const setText = vi.fn();
  const memorySetText = vi.fn();

  return {
    harness: {
      getDisplayState: vi.fn(() => ({
        omProgress: { status: 'idle' },
        bufferingMessages: false,
        bufferingObservations: false,
      })),
      listModes: vi.fn(() => [{ id: 'build', name: 'build', color: '#00ff00' }]),
      getCurrentMode: vi.fn(() => ({ id: 'build', name: 'build', color: '#00ff00' })),
      getCurrentModeId: vi.fn(() => 'build'),
      getState: vi.fn(() => ({ yolo: false })),
      getObserverModelId: vi.fn(() => 'openai/gpt-4o'),
      getReflectorModelId: vi.fn(() => 'openai/gpt-4o-mini'),
      getFullModelId: vi.fn(() => 'anthropic/claude-sonnet-4-20250514'),
      getFollowUpCount: vi.fn(() => 0),
    },
    statusLine: { setText },
    memoryStatusLine: { setText: memorySetText },
    editor: {},
    gradientAnimator: undefined,
    modelAuthStatus: { hasAuth: true, apiKeyEnvVar: undefined },
    projectInfo: { rootPath: '/Users/tylerbarnes/code/mastra-ai/mastra--feat-mc-queueing-ux', gitBranch: 'feat/mc-queueing-ux' },
    pendingQueuedActions: [],
    ui: { requestRender: vi.fn() },
  } as any;
}

describe('updateStatusLine', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    visibleWidthMock.mockClear();
    process.stdout.columns = 200;
  });

  afterEach(() => {
    process.stdout.columns = originalColumns;
  });

  it('shows queued message count in the status line', () => {
    const state = createState();
    state.pendingQueuedActions = ['message', 'slash'];
    state.harness.getFollowUpCount.mockReturnValue(1);

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('3 queued messages');
    expect(state.memoryStatusLine.setText).toHaveBeenCalledWith('');
  });

  it('omits the queued message count when nothing is queued', () => {
    const state = createState();

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).not.toContain('queued message');
  });
});
