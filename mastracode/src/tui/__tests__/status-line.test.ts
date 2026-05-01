import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { visibleWidthMock } = vi.hoisted(() => ({
  visibleWidthMock: vi.fn((value: string) => value.length),
}));

vi.mock('@mariozechner/pi-tui', () => ({
  visibleWidth: visibleWidthMock,
}));

vi.mock('chalk', () => {
  // Recursive proxy that supports arbitrary chaining (e.g. chalk.hex(...).bold.italic(...))
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        // Methods that take args (hex, bgHex, rgb, bgRgb) return a new chain
        if (['hex', 'bgHex', 'rgb', 'bgRgb'].includes(prop as string)) return () => makeChain();
        // Properties like bold, italic, dim return a new chain
        return makeChain();
      },
    });

  return { default: makeChain() };
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
  ensureContrast: (_color: string) => _color,
  TUI_MIN_CONTRAST: 5.5,
  getTermWidth: () => process.stdout.columns || 200,
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
    projectInfo: {
      rootPath: '/Users/tylerbarnes/code/mastra-ai/mastra--feat-mc-queueing-ux',
      gitBranch: 'feat/mc-queueing-ux',
    },
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

  it('shows queued count in the status line', () => {
    const state = createState();
    state.pendingQueuedActions = ['message', 'slash'];
    state.harness.getFollowUpCount.mockReturnValue(1);

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('3 queued');
    expect(state.memoryStatusLine.setText).toHaveBeenCalledWith('');
  });

  it('omits the queued count when nothing is queued', () => {
    const state = createState();

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).not.toContain('queued');
  });

  it('preserves the gateway prefix when compacting gateway-backed model ids', () => {
    const state = createState();
    state.harness.getFullModelId.mockReturnValue('mastra/anthropic/claude-opus-4.6');
    process.stdout.columns = 25;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('mastra/claude-opus-4.6');
    expect(rendered).not.toContain('anthropic/claude-opus-4.6');
  });

  it('rewrites fireworks-ai long paths and kimi version separator at full width', () => {
    const state = createState();
    state.harness.getFullModelId.mockReturnValue('fireworks-ai/accounts/fireworks/models/kimi-k2p6');
    process.stdout.columns = 200;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('fireworks/kimi-k2.6');
    expect(rendered).not.toContain('fireworks-ai/accounts/fireworks/models/');
    expect(rendered).not.toContain('kimi-k2p6');
  });

  it('rewrites fireworks-ai long paths and kimi version separator when compacted', () => {
    const state = createState();
    state.harness.getFullModelId.mockReturnValue('fireworks-ai/accounts/fireworks/models/kimi-k2p6');
    process.stdout.columns = 25;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('fireworks/kimi-k2.6');
    expect(rendered).not.toContain('fireworks-ai/accounts/fireworks/models/');
    expect(rendered).not.toContain('kimi-k2p6');
  });

  it('rewrites kimi version separator for non-fireworks models', () => {
    const state = createState();
    state.harness.getFullModelId.mockReturnValue('moonshot/kimi-k1p5');
    process.stdout.columns = 200;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('kimi-k1.5');
    expect(rendered).not.toContain('kimi-k1p5');
  });

  it('rewrites minimax-m2p7 version separator', () => {
    const state = createState();
    state.harness.getFullModelId.mockReturnValue('fireworks-ai/accounts/fireworks/models/minimax-m2p7');
    process.stdout.columns = 200;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('fireworks/minimax-m2.7');
    expect(rendered).not.toContain('minimax-m2p7');
  });
});
