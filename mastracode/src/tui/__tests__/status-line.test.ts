import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { visibleWidthMock, chalkRgbMock, applyGradientSweepMock } = vi.hoisted(() => ({
  visibleWidthMock: vi.fn((value: string) => value.length),
  chalkRgbMock: vi.fn(),
  applyGradientSweepMock: vi.fn((value: string) => value),
}));

vi.mock('@earendil-works/pi-tui', () => ({
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
  extendedColors: {
    skyBlue: '#0ea5e9',
  },
  tintHex: (_color: string, _amount: number) => '#111111',
  getThemeMode: () => 'dark',
  ensureContrast: (_color: string) => _color,
  TUI_MIN_CONTRAST: 5.5,
  getTermWidth: () => process.stdout.columns || 200,
}));

import { formatObservationStatus, formatReflectionStatus } from '../components/om-progress.js';
import { updateStatusLine } from '../status-line.js';

function createState() {
  const setText = vi.fn();
  const memorySetText = vi.fn();

  const session = {
    displayState: {
      get: vi.fn(() => ({
        omProgress: { status: 'idle' },
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
    vi.mocked(formatObservationStatus).mockReturnValue('');
    vi.mocked(formatReflectionStatus).mockReturnValue('');
    applyGradientSweepMock.mockClear();
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

  it('shows the active GitHub PR subscription beside the thread path', () => {
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

  it('does not animate the GitHub PR subscription during unrelated agent activity', () => {
    const state = createState();
    state.activeGithubPrSubscriptions = [{ prNumber: 17439 }];
    state.gradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.5),
      getFadeProgress: vi.fn(() => 0),
    };

    updateStatusLine(state);

    expect(applyGradientSweepMock).not.toHaveBeenCalledWith(
      'PR#17439',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('animates the GitHub PR subscription while GitHub polling is running', () => {
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

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).not.toContain('PR#');
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
    expect(rendered).toContain('fireworks/kimi-k2.6');
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
    expect(rendered).not.toContain('claude-sonnet-4-20250514');
    expect(chalkRgbMock).toHaveBeenCalledWith(53, 117, 221);
  });

  it('uses abbreviated long branch before truncating path and dropping branch context', () => {
    const state = createState();
    state.projectInfo.gitBranch = 'feature/super-long-branch-name-for-status-footer-e2e-regression-shield-extra-long';
    process.stdout.columns = 80;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('feature/supe..tra-long');
    expect(rendered).not.toContain('mastra--feat-mc-queueing-ux…');
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
    expect(rendered).toContain('pursuing goal (1hr10m)');
    expect(rendered).not.toContain('goal attempt');
    expect(rendered).not.toContain('1/20');
    vi.useRealTimers();
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
    expect(rendered).toContain('pursuing goal (10m)');
    expect(rendered).not.toContain('6hr10m');
    vi.useRealTimers();
  });

  it('uses a compact active goal duration label on narrow screens', () => {
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
    expect(rendered).toContain('goal (2days3hr)');
    expect(rendered).not.toContain('pursuing goal');
    vi.useRealTimers();
  });

  it('keeps judge status ahead of OM and long model details on narrow screens', () => {
    vi.mocked(formatObservationStatus).mockReturnValue('msg 100%');
    vi.mocked(formatReflectionStatus).mockReturnValue('mem 100%');
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
    expect(rendered).not.toContain('msg 100%');
    expect(rendered).not.toContain('mem 100%');
    expect(rendered).not.toContain('claude-sonnet-4-20250514');
  });
});
