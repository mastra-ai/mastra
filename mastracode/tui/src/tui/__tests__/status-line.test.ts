import type * as PiTui from '@earendil-works/pi-tui';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { visibleWidthMock, chalkRgbMock, applyGradientSweepMock } = vi.hoisted(() => ({
  visibleWidthMock: vi.fn((value: string) => value.length),
  chalkRgbMock: vi.fn(),
  applyGradientSweepMock: vi.fn((value: string) => value),
}));

vi.mock('@earendil-works/pi-tui', async importOriginal => ({
  ...(await importOriginal<typeof PiTui>()),
  visibleWidth: visibleWidthMock,
}));

vi.mock('chalk', () => {
  // Recursive proxy that supports arbitrary chaining (e.g. chalk.hex(...).bold.italic(...))
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        // Methods that take args (hex, bgHex, rgb, bgRgb) return a new chain
        if (prop === 'rgb') {
          return (...args: unknown[]) => {
            chalkRgbMock(...args);
            return makeChain();
          };
        }
        if (['hex', 'bgHex', 'bgRgb'].includes(prop as string)) return () => makeChain();
        // Properties like bold, italic, dim return a new chain
        return makeChain();
      },
    });

  return { default: makeChain() };
});

vi.mock('../components/obi-loader.js', () => ({
  applyGradientSweep: applyGradientSweepMock,
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
  mastraBrand: {
    blue: '#2563eb',
  },
  extendedColors: {
    skyBlue: '#0ea5e9',
    lightCyan: '#22d3ee',
    indigo: '#6366f1',
  },
  tintHex: (color: string, amount: number) => {
    const channels = [1, 3, 5].map(offset => Math.floor(parseInt(color.slice(offset, offset + 2), 16) * amount));
    return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  },
  getThemeMode: () => 'dark',
  ensureContrast: (_color: string) => _color,
  TUI_MIN_CONTRAST: 5.5,
  getTermWidth: () => process.stdout.columns || 200,
}));

import { updateStatusLine } from '../status-line.js';

function createState() {
  const setText = vi.fn();
  const memorySetText = vi.fn();

  const session = {
    displayState: {
      get: vi.fn(() => ({
        omProgress: {
          status: 'idle',
          pendingTokens: 30_000,
          threshold: 80_000,
          thresholdPercent: 37.5,
          observationTokens: 30_000,
          reflectionThreshold: 40_000,
          reflectionThresholdPercent: 75,
          buffered: {
            observations: { projectedMessageRemoval: 2_000 },
            reflection: { status: 'complete', inputObservationTokens: 5_000, observationTokens: 3_000 },
          },
        },
        bufferingMessages: false,
        bufferingObservations: false,
      })),
    },
    followUps: { count: vi.fn(() => 0) },
    identity: { getResourceId: vi.fn(() => 'resource-1') },
    thread: { getId: vi.fn(() => 'thread-1') },
    mode: {
      get: vi.fn(() => 'build'),
      resolve: vi.fn(() => ({ id: 'build', name: 'build', metadata: { color: '#00ff00' } })),
    },
    state: { get: vi.fn(() => ({ yolo: false })) },
    model: {
      get: vi.fn(() => 'anthropic/claude-sonnet-4-20250514'),
    },
    om: {
      observer: { modelId: vi.fn(() => 'openai/gpt-4o') },
      reflector: { modelId: vi.fn(() => 'openai/gpt-4o-mini') },
    },
  };

  return {
    options: {},
    session,
    controller: {
      listModes: vi.fn(() => [{ id: 'build', name: 'build', metadata: { color: '#00ff00' } }]),
      session,
    },
    statusLine: { setText },
    memoryStatusLine: { setText: memorySetText },
    editor: {},
    gradientAnimator: undefined,
    githubPrGradientAnimator: undefined,
    githubPrPollingActive: false,
    modelAuthStatus: { hasAuth: true, apiKeyEnvVar: undefined },
    projectInfo: {
      rootPath: '/Users/tylerbarnes/code/mastra-ai/mastra--feat-mc-queueing-ux',
      gitBranch: 'feat/mc-queueing-ux',
    },
    pendingQueuedActions: [],
    activeGithubPrSubscriptions: [],
    goalManager: { getGoal: vi.fn(() => null) },
    ui: { requestRender: vi.fn() },
  } as any;
}

describe('updateStatusLine', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    visibleWidthMock.mockClear();
    chalkRgbMock.mockClear();
    applyGradientSweepMock.mockClear();
    applyGradientSweepMock.mockImplementation((value: string) => value);
    process.stdout.columns = 200;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.stdout.columns = originalColumns;
  });

  it('shows queued count in the status line', () => {
    const state = createState();
    state.pendingQueuedActions = ['message', 'slash'];
    state.session.followUps.count.mockReturnValue(1);

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

  it('shows active elapsed time directly after the model name', () => {
    vi.useFakeTimers();
    vi.setSystemTime(62_000);
    const state = createState();
    state.agentRunStartedAt = 1_000;
    state.controller.session.model.get.mockReturnValue('openai/gpt-5');

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('openai/gpt-5 1m1s');
    expect(rendered).not.toContain('worked for');
    vi.useRealTimers();
  });

  it('keeps successful completed run timing beside the model with a checkmark', () => {
    const state = createState();
    state.lastAgentRunDurationMs = 61_000;
    state.lastAgentRunEndedAt = 1_000;
    state.lastAgentRunEndReason = 'done';
    state.controller.session.model.get.mockReturnValue('openai/gpt-5');

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('openai/gpt-5 1m1s ✓');
    expect(rendered).not.toContain('done in');
  });

  it('keeps aborted timing beside the model without an icon and errored timing with an x', () => {
    const aborted = createState();
    aborted.lastAgentRunDurationMs = 61_000;
    aborted.lastAgentRunEndedAt = 1_000;
    aborted.lastAgentRunEndReason = 'aborted';
    aborted.controller.session.model.get.mockReturnValue('openai/gpt-5');

    updateStatusLine(aborted);

    expect(aborted.statusLine.setText.mock.calls[0]?.[0]).toContain('openai/gpt-5 1m1s');
    expect(aborted.statusLine.setText.mock.calls[0]?.[0]).not.toContain('1m1s ×');
    expect(aborted.statusLine.setText.mock.calls[0]?.[0]).not.toContain('1m1s ✓');

    const errored = createState();
    errored.lastAgentRunDurationMs = 61_000;
    errored.lastAgentRunEndedAt = 1_000;
    errored.lastAgentRunEndReason = 'error';
    errored.controller.session.model.get.mockReturnValue('openai/gpt-5');

    updateStatusLine(errored);

    expect(errored.statusLine.setText.mock.calls[0]?.[0]).toContain('openai/gpt-5 1m1s ×');
  });

  it('shows the active GitHub PR subscription beside the thread title', () => {
    const state = createState();
    state.currentThreadTitle = 'Simplify the OM status indicator';
    state.activeGithubPrSubscriptions = [{ prNumber: 17439 }];

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('PR#17439 Simplify the OM status indicator');
    expect(rendered).not.toContain('feat/mc-queueing-ux');
  });

  it('shows the active GitHub PR subscription without status noise', () => {
    const state = createState();
    state.activeGithubPrSubscriptions = [
      {
        owner: 'mastra-ai',
        repo: 'mastra',
        prNumber: 17439,
        lastNotificationKind: 'pull-request-activity',
        lastNotificationPriority: 'medium',
      },
    ];

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('PR#17439');
    expect(rendered).not.toContain('polling');
    expect(rendered).not.toContain('updated');
  });

  it('keeps the PR label within the available width when truncating a long thread title', () => {
    const state = createState();
    state.currentThreadTitle = 'A very long thread title that must be truncated';
    state.activeGithubPrSubscriptions = [{ prNumber: 17439 }];
    process.stdout.columns = 70;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(visibleWidthMock(rendered)).toBeLessThanOrEqual(70);
    expect(rendered).toContain('PR#17439');
    expect(rendered).toContain('60/120k');
    expect(rendered).not.toContain('━━━━━━━━━━');
  });

  it('shows the PR label without a thread title or branch and uses orange for high priority', () => {
    const state = createState();
    state.currentThreadTitle = undefined;
    state.projectInfo.gitBranch = undefined;
    state.activeGithubPrSubscriptions = [{ prNumber: 17439, lastNotificationPriority: 'high' }];
    state.githubPrPollingActive = true;
    state.githubPrGradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.5),
      getFadeProgress: vi.fn(() => 0),
    };

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls[0]?.[0]).toContain('PR#17439');
    expect(applyGradientSweepMock).toHaveBeenCalledWith('PR#17439', 0.5, '#f97316', 0);
  });

  it('animates the GitHub PR subscription only while GitHub polling is running', () => {
    const state = createState();
    state.activeGithubPrSubscriptions = [{ prNumber: 17439 }];
    state.githubPrPollingActive = true;
    state.githubPrGradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.5),
      getFadeProgress: vi.fn(() => 0),
    };

    updateStatusLine(state);

    expect(applyGradientSweepMock).toHaveBeenCalledWith('PR#17439', 0.5, '#0ea5e9', 0);
  });

  it('does not show GitHub PR status for unsubscribed threads', () => {
    const state = createState();

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls[0]?.[0]).not.toContain('PR#');
  });

  it('preserves the gateway prefix when compacting gateway-backed model ids', () => {
    const state = createState();
    state.controller.session.model.get.mockReturnValue('mastra/anthropic/claude-opus-4.6');
    process.stdout.columns = 25;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('mastra/claude-opus-4.6');
    expect(rendered).not.toContain('anthropic/claude-opus-4.6');
  });

  it('rewrites fireworks-ai long paths and kimi version separator at full width', () => {
    const state = createState();
    state.controller.session.model.get.mockReturnValue('fireworks-ai/accounts/fireworks/models/kimi-k2p6');
    process.stdout.columns = 200;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('fireworks/kimi-k2.6');
    expect(rendered).not.toContain('fireworks-ai/accounts/fireworks/models/');
    expect(rendered).not.toContain('kimi-k2p6');
  });

  it('rewrites fireworks-ai long paths and kimi version separator when compacted', () => {
    const state = createState();
    state.controller.session.model.get.mockReturnValue('fireworks-ai/accounts/fireworks/models/kimi-k2p6');
    process.stdout.columns = 25;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('kimi-k2.6');
    expect(rendered).not.toContain('fireworks-ai/accounts/fireworks/models/');
    expect(rendered).not.toContain('kimi-k2p6');
  });

  it('rewrites kimi version separator for non-fireworks models', () => {
    const state = createState();
    state.controller.session.model.get.mockReturnValue('moonshot/kimi-k1p5');
    process.stdout.columns = 200;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('kimi-k1.5');
    expect(rendered).not.toContain('kimi-k1p5');
  });

  it('rewrites minimax-m2p7 version separator', () => {
    const state = createState();
    state.controller.session.model.get.mockReturnValue('fireworks-ai/accounts/fireworks/models/minimax-m2p7');
    process.stdout.columns = 200;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('fireworks/minimax-m2.7');
    expect(rendered).not.toContain('minimax-m2p7');
  });

  it('shows judge mode and judge model while goal judge is active', () => {
    const state = createState();
    state.controller.listModes.mockReturnValue([
      { id: 'build', name: 'build', metadata: { color: '#00ff00' } },
      { id: 'fast', name: 'Fast', metadata: { color: '#f97316' } },
    ]);
    state.activeGoalJudge = { modelId: 'openrouter/openai/gpt-5.4-mini' };

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('judge');
    expect(rendered).toContain('openai/gpt-5.4-mini');
    expect(rendered).not.toContain('goal');
    expect(rendered).not.toContain('anthropic/claude-sonnet-4-20250514');
    expect(chalkRgbMock).toHaveBeenCalledWith(53, 117, 221);
  });

  it('shows the thread title in the center and abbreviates it when needed', () => {
    const state = createState();
    state.currentThreadTitle = 'A much longer generated thread title that should appear';
    state.projectInfo.gitBranch = 'feature/super-long-branch-name-for-status-footer-e2e-regression-shield-extra-long';
    process.stdout.columns = 80;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('A much longe..d appear');
    expect(rendered).toContain('60/120k');
    expect(rendered).not.toContain('━━━━━━━━━━');
    expect(rendered).not.toContain('feature/super-long-branch');
    expect(rendered).not.toContain('mastra--feat-mc-queueing-ux');
  });

  it('shows active goal duration instead of attempt count', () => {
    vi.useFakeTimers();
    const now = new Date('2026-05-15T12:00:00.000Z');
    vi.setSystemTime(now);
    const state = createState();
    state.goalManager = {
      getGoal: vi.fn(() => ({
        status: 'active',
        turnsUsed: 0,
        maxTurns: 20,
        startedAt: '2026-05-15T10:50:00.000Z',
        activeStartedAt: '2026-05-15T10:50:00.000Z',
        activeDurationMs: 0,
      })),
    };

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('goal 1hr10m');
    expect(rendered).not.toContain('· goal');
    expect(rendered).not.toContain('goal attempt');
    expect(rendered).not.toContain('1/20');
    vi.useRealTimers();
  });

  it('places goal after run duration, hides a matching goal time, and puts throughput before context', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:30.000Z'));
    const state = createState();
    state.agentRunStartedAt = Date.parse('2026-05-15T12:00:00.000Z');
    state.tokensPerSec = 80;
    state.goalManager = {
      getGoal: vi.fn(() => ({
        status: 'active',
        startedAt: '2026-05-15T12:00:00.000Z',
      })),
    };

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0] as string;
    expect(rendered).toContain('30s · goal');
    expect(rendered).not.toContain('goal <1m');
    expect(rendered).toMatch(/ 80 t\/s\s+━━━━━━━━━━/);
    expect(rendered).not.toContain('tok/s');

    state.tokensPerSec = 120;
    updateStatusLine(state);
    const renderedOver100 = state.statusLine.setText.mock.calls[1]?.[0] as string;
    expect(renderedOver100).toMatch(/120 t\/s\s+━━━━━━━━━━/);
    expect(renderedOver100.indexOf(state.projectInfo.gitBranch)).toBe(rendered.indexOf(state.projectInfo.gitBranch));
  });

  it('freezes active goal duration while waiting for user input', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T17:00:00.000Z'));
    const state = createState();
    state.goalManager = {
      getGoal: vi.fn(() => ({
        status: 'active',
        turnsUsed: 0,
        maxTurns: 20,
        startedAt: '2026-05-15T10:50:00.000Z',
        activeDurationMs: 10 * 60_000,
      })),
    };

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('goal 10m');
    expect(rendered).not.toContain('6hr10m');
    vi.useRealTimers();
  });

  it('keeps the concise active goal duration label on narrow screens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    const state = createState();
    state.goalManager = {
      getGoal: vi.fn(() => ({
        status: 'active',
        turnsUsed: 0,
        maxTurns: 20,
        startedAt: '2026-05-13T09:00:00.000Z',
        activeStartedAt: '2026-05-13T09:00:00.000Z',
        activeDurationMs: 0,
      })),
    };
    process.stdout.columns = 35;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('goal 2days3hr');
    expect(rendered).not.toContain('pursuing');
    expect(rendered).not.toContain('(');
    vi.useRealTimers();
  });

  it('keeps judge status ahead of OM and long model details on narrow screens', () => {
    const state = createState();
    state.controller.session.displayState.get.mockReturnValue({
      omProgress: { status: 'observing' },
      bufferingMessages: true,
      bufferingObservations: true,
    });
    state.activeGoalJudge = { modelId: 'openrouter/openai/gpt-5.4-mini' };
    state.goalManager = {
      getGoal: vi.fn(() => ({
        status: 'active',
        turnsUsed: 3,
        maxTurns: 20,
        startedAt: '2026-05-15T10:50:00.000Z',
        activeDurationMs: 5 * 60_000,
      })),
    };
    process.stdout.columns = 30;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('j');
    expect(rendered).toContain('gpt-5.4-mini');
    expect(rendered).not.toContain('observe');
    expect(rendered).not.toContain('━');
    expect(rendered).not.toContain('anthropic/claude-sonnet-4-20250514');
  });

  it('renders one unified context indicator with combined totals and savings', () => {
    const state = createState();

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('━━━━━━━━━━  60/120k↓ ');
    expect(rendered.indexOf('feat/mc-queueing-ux')).toBeLessThan(rendered.indexOf('━━━━━━━━━━'));
    expect(rendered).toMatch(/━━━━━━━━━━  60\/120k↓ $/);
    expect(rendered).not.toContain('messages');
    expect(rendered).not.toContain('memory');
  });

  it('keeps the indicator anchored when the savings arrow disappears', () => {
    const state = createState();
    updateStatusLine(state);
    const withSavings = state.statusLine.setText.mock.calls[0]?.[0] as string;

    const displayState = state.session.displayState.get();
    displayState.omProgress.buffered.observations.projectedMessageRemoval = 0;
    displayState.omProgress.buffered.reflection.inputObservationTokens = 3_000;
    displayState.omProgress.buffered.reflection.observationTokens = 3_000;
    state.session.displayState.get.mockReturnValue(displayState);
    state.statusLine.setText.mockClear();
    updateStatusLine(state);
    const withoutSavings = state.statusLine.setText.mock.calls[0]?.[0] as string;

    expect(withoutSavings).not.toContain('↓');
    expect(withoutSavings.indexOf('━━━━━━━━━━')).toBe(withSavings.indexOf('━━━━━━━━━━'));
    expect(visibleWidthMock(withoutSavings)).toBe(visibleWidthMock(withSavings));
  });

  it('drops only the context bar before core status content at 60 columns', () => {
    const state = createState();
    process.stdout.columns = 60;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('feat/mc-que');
    expect(rendered).toContain('60/120k');
    expect(rendered).not.toContain('━━━━━━━━━━');
  });

  it('keeps the provider animation active while animating the message segment', () => {
    const state = createState();
    process.stdout.columns = 200;
    state.controller.listModes.mockReturnValue([
      { id: 'build', name: 'build', metadata: { color: '#00ff00' } },
      { id: 'plan', name: 'plan', metadata: { color: '#0000ff' } },
    ]);
    const displayState = state.session.displayState.get();
    state.session.displayState.get.mockReturnValue({ ...displayState, bufferingMessages: true });
    state.gradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.5),
      getFadeProgress: vi.fn(() => 0),
    };
    applyGradientSweepMock.mockImplementation((value: string) => `<sweep>${value}</sweep>`);

    updateStatusLine(state);

    expect(applyGradientSweepMock).toHaveBeenCalledTimes(2);
    expect(applyGradientSweepMock.mock.calls.map(call => call[0])).toEqual([
      'anthropic/claude-sonnet-4-20250514',
      '━━━',
    ]);
    expect(applyGradientSweepMock).toHaveBeenCalledWith('━━━', 0.5, '#00ff00', 0);
    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('━━<sweep>━━━</sweep>━━━━━  60/120k↓ ');
  });

  it('keeps the provider animation active while animating the memory segment', () => {
    const state = createState();
    process.stdout.columns = 200;
    state.controller.listModes.mockReturnValue([
      { id: 'build', name: 'build', metadata: { color: '#00ff00' } },
      { id: 'plan', name: 'plan', metadata: { color: '#0000ff' } },
    ]);
    const displayState = state.session.displayState.get();
    state.session.displayState.get.mockReturnValue({ ...displayState, bufferingObservations: true });
    state.gradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.25),
      getFadeProgress: vi.fn(() => 0.1),
    };

    updateStatusLine(state);

    expect(applyGradientSweepMock).toHaveBeenCalledTimes(2);
    expect(applyGradientSweepMock.mock.calls.map(call => call[0])).toEqual([
      'anthropic/claude-sonnet-4-20250514',
      '━━',
    ]);
    expect(applyGradientSweepMock).toHaveBeenCalledWith('━━', 0.25, '#2563eb', 0.1);
  });

  it('keeps the provider animation active while animating both occupied segments', () => {
    const state = createState();
    process.stdout.columns = 200;
    state.controller.listModes.mockReturnValue([
      { id: 'build', name: 'build', metadata: { color: '#00ff00' } },
      { id: 'plan', name: 'plan', metadata: { color: '#0000ff' } },
    ]);
    const displayState = state.session.displayState.get();
    state.session.displayState.get.mockReturnValue({
      ...displayState,
      bufferingMessages: true,
      bufferingObservations: true,
    });
    state.gradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.5),
      getFadeProgress: vi.fn(() => 0),
    };

    updateStatusLine(state);

    expect(applyGradientSweepMock).toHaveBeenCalledTimes(3);
    expect(applyGradientSweepMock.mock.calls.map(call => call[0])).toEqual([
      'anthropic/claude-sonnet-4-20250514',
      '━━',
      '━━━',
    ]);
  });
});
