import type * as PiTui from '@earendil-works/pi-tui';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const { visibleWidthMock, chalkRgbMock, applyGradientSweepMock, getEffectiveOMRoleModelIdMock } = vi.hoisted(() => ({
  getEffectiveOMRoleModelIdMock: vi.fn((_session: unknown, role: 'observer' | 'reflector') =>
    role === 'observer' ? 'deepseek/deepseek-v4-flash' : 'anthropic/claude-haiku-4-5',
  ),
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

vi.mock('../om-model.js', () => ({
  getEffectiveOMRoleModelId: getEffectiveOMRoleModelIdMock,
}));

vi.mock('../theme.js', () => ({
  theme: {
    fg: (_tone: string, value: string) => value,
    bold: (value: string) => value,
    getTheme: () => ({ accent: '#62f69d' }),
  },
  displayModeColor: (color: string) => color,
  getContrastBg: () => '#000000',
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
        queuedFollowUps: 0,
      })),
    },
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
    pendingSlashCommands: [],
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
    getEffectiveOMRoleModelIdMock.mockClear();
    applyGradientSweepMock.mockImplementation((value: string) => value);
    process.stdout.columns = 200;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.stdout.columns = originalColumns;
  });

  it('shows queued count in the status line', () => {
    const state = createState();
    state.pendingSlashCommands = ['/a', '/b'];
    state.session.displayState.get.mockReturnValue({
      ...state.session.displayState.get(),
      queuedFollowUps: 1,
    });

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

  it('shows the landed fallback pack and failed source pack', () => {
    const state = createState();
    state.fallbackStatus = { usingPack: 'OpenAI', failedPack: 'Anthropic' };

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('Using fallback OpenAI (Anthropic failed)');
  });

  it('shows active elapsed time in the Working row instead of the status line', () => {
    vi.useFakeTimers();
    vi.setSystemTime(62_000);
    const state = createState();
    state.idleCounter = { setActivity: vi.fn(), isThinking: () => false };
    state.agentRunStartedAt = 1_000;
    state.tokensPerSec = 48;
    state.controller.session.model.get.mockReturnValue('openai/gpt-5');

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    const activity = state.idleCounter.setActivity.mock.calls[0]?.[0];
    expect(rendered).toContain('openai/gpt-5');
    expect(rendered).not.toContain('1m1s');
    expect(activity).toContain('1m1s · 48 tok/s · esc to interrupt');
    vi.useRealTimers();
  });

  it('clears the Working row when the agent is idle', () => {
    const state = createState();
    state.idleCounter = { setActivity: vi.fn(), isThinking: () => false };

    updateStatusLine(state);

    expect(state.idleCounter.setActivity).toHaveBeenCalledWith('');
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

  it('shows a GitHub PR subscription count when multiple PRs are active', () => {
    const state = createState();
    state.activeGithubPrSubscriptions = [{ prNumber: 17439 }, { prNumber: 17440 }, { prNumber: 17441 }];

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain('3 PRs');
    expect(rendered).not.toContain('PR#17439');
  });

  it('keeps the PR label within the available width when truncating a long thread title', () => {
    const state = createState();
    state.currentThreadTitle = 'A very long thread title that must be truncated';
    state.activeGithubPrSubscriptions = [{ prNumber: 17439 }];
    process.stdout.columns = 80;

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(visibleWidthMock(rendered)).toBeLessThanOrEqual(80);
    expect(rendered).toContain('PR#17439');
    expect(rendered).toContain('60/120k');
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
    expect(rendered).toMatch(/^ judge · openrouter\/openai\/gpt-5\.4-mini/);
    expect(rendered).not.toContain('goal');
    expect(rendered).not.toContain('anthropic/claude-sonnet-4-20250514');
  });

  it('moves the thread title to a second row when it does not fit, and truncates it there', () => {
    const state = createState();
    state.currentThreadTitle = 'A much longer generated thread title that should appear';
    state.projectInfo.gitBranch = 'feature/super-long-branch-name-for-status-footer-e2e-regression-shield-extra-long';
    process.stdout.columns = 80;

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls[0]?.[0]).toBe(' anthropic/claude-sonnet-4-20250514 · 60/120k↓ 50%');
    expect(state.memoryStatusLine.setText).toHaveBeenLastCalledWith(
      ' A much longer generated thread title that should appear',
    );

    process.stdout.columns = 40;
    updateStatusLine(state);

    const second = state.memoryStatusLine.setText.mock.lastCall?.[0];
    expect(second).toMatch(/^ A much longer generated thread title …$/);
    expect(visibleWidthMock(second)).toBeLessThanOrEqual(40);
  });

  it('shows the project path and branch when there is no thread title', () => {
    const state = createState();
    state.projectInfo.rootPath = '/repo/acme-api';

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls[0]?.[0]).toBe(
      ' anthropic/claude-sonnet-4-20250514 · 60/120k↓ 50% · /repo/acme-api (feat/mc-queueing-ux)',
    );
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
    expect(rendered).toContain(' · goal 1hr10m · ');
    expect(rendered).not.toContain('goal attempt');
    expect(rendered).not.toContain('1/20');
    vi.useRealTimers();
  });

  it('hides a goal time that matches the active run and keeps throughput out of the status line', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:30.000Z'));
    const state = createState();
    state.idleCounter = { setActivity: vi.fn(), isThinking: () => false };
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
    expect(rendered).toContain(' · goal · ');
    expect(rendered).not.toContain('goal <1m');
    expect(rendered).not.toContain('t/s');
    expect(state.idleCounter.setActivity.mock.calls[0]?.[0]).toContain('30s · 80 tok/s');
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

  it('resolves the OM role model once per observing or reflecting phase', () => {
    const state = createState();
    const base = state.controller.session.displayState.get();
    const setStatus = (status: string) =>
      state.controller.session.displayState.get.mockReturnValue({
        ...base,
        omProgress: { ...base.omProgress, status },
      });

    setStatus('observing');
    updateStatusLine(state);
    updateStatusLine(state);
    updateStatusLine(state);
    expect(getEffectiveOMRoleModelIdMock).toHaveBeenCalledTimes(1);
    expect(getEffectiveOMRoleModelIdMock).toHaveBeenLastCalledWith(state.session, 'observer');
    expect(state.statusLine.setText.mock.calls.at(-1)?.[0]).toContain('deepseek-v4-flash');

    setStatus('reflecting');
    updateStatusLine(state);
    updateStatusLine(state);
    expect(getEffectiveOMRoleModelIdMock).toHaveBeenCalledTimes(2);
    expect(getEffectiveOMRoleModelIdMock).toHaveBeenLastCalledWith(state.session, 'reflector');
    expect(state.statusLine.setText.mock.calls.at(-1)?.[0]).toContain('claude-haiku-4-5');

    setStatus('idle');
    updateStatusLine(state);
    setStatus('observing');
    updateStatusLine(state);
    expect(getEffectiveOMRoleModelIdMock).toHaveBeenCalledTimes(3);
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

  it('renders the context as combined totals, savings arrow and percentage', () => {
    const state = createState();

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0];
    expect(rendered).toContain(' · 60/120k↓ 50% · ');
    expect(rendered).not.toContain('━');
    expect(rendered).not.toContain('messages');
    expect(rendered).not.toContain('memory');
  });

  it('drops the savings arrow when nothing is buffered', () => {
    const state = createState();
    const displayState = state.session.displayState.get();
    displayState.omProgress.buffered.observations.projectedMessageRemoval = 0;
    displayState.omProgress.buffered.reflection.inputObservationTokens = 3_000;
    displayState.omProgress.buffered.reflection.observationTokens = 3_000;
    state.session.displayState.get.mockReturnValue(displayState);

    updateStatusLine(state);

    const rendered = state.statusLine.setText.mock.calls[0]?.[0] as string;
    expect(rendered).toContain(' · 60/120k 50% · ');
    expect(rendered).not.toContain('↓');
  });

  it('keeps one row with a shortened path when the full path does not fit but the short one does', () => {
    const state = createState();
    process.stdout.columns = 110;

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls[0]?.[0]).toBe(
      ' anthropic/claude-sonnet-4-20250514 · 60/120k↓ 50% · /…/mastra--feat-mc-queueing-ux (feat/mc-queueing-ux)',
    );
    expect(state.memoryStatusLine.setText).toHaveBeenLastCalledWith('');
  });

  it('moves the location to a second row and shortens the path like zsh at 60 columns', () => {
    const state = createState();
    process.stdout.columns = 60;

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls[0]?.[0]).toBe(' anthropic/claude-sonnet-4-20250514 · 60/120k↓ 50%');
    expect(state.memoryStatusLine.setText).toHaveBeenLastCalledWith(
      ' /…/mastra--feat-mc-queueing-ux (feat/mc-queueing-ux)',
    );
  });

  it('keeps the parent directory when it fits and shortens home paths to ~', () => {
    const state = createState();
    state.projectInfo.rootPath = `${process.env.HOME}/dev/mastra/mastracode/tui`;
    state.projectInfo.gitBranch = 'feat/mc-animation';
    process.stdout.columns = 45;

    updateStatusLine(state);

    expect(state.memoryStatusLine.setText).toHaveBeenLastCalledWith(' ~/…/mastracode/tui (feat/mc-animation)');
  });

  it('does not treat a sibling folder that starts with the home path as home', () => {
    const state = createState();
    state.projectInfo.rootPath = `${process.env.HOME}-old/app`;
    state.projectInfo.gitBranch = 'main';
    process.stdout.columns = 200;

    updateStatusLine(state);

    expect(state.statusLine.setText.mock.calls.at(-1)?.[0]).toContain(`${process.env.HOME}-old/app (main)`);
  });

  it('keeps the branch alone, then cuts it, when even the last directory does not fit', () => {
    const state = createState();
    process.stdout.columns = 24;

    updateStatusLine(state);

    expect(state.memoryStatusLine.setText).toHaveBeenLastCalledWith(' feat/mc-queueing-ux');

    state.projectInfo.gitBranch = undefined;
    process.stdout.columns = 30;
    updateStatusLine(state);

    expect(state.memoryStatusLine.setText).toHaveBeenLastCalledWith(' /…/mastra--feat-mc…eueing-ux');
  });

  it('sweeps the context counter in the mode color while messages buffer', () => {
    const state = createState();
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

    expect(applyGradientSweepMock).toHaveBeenCalledWith('60/120k↓', 0.5, '#00ff00', 0);
    expect(state.statusLine.setText.mock.calls[0]?.[0]).toContain('<sweep>60/120k↓</sweep> 50%');
  });

  it('sweeps the context counter in blue while observations buffer', () => {
    const state = createState();
    const displayState = state.session.displayState.get();
    state.session.displayState.get.mockReturnValue({ ...displayState, bufferingObservations: true });
    state.gradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.25),
      getFadeProgress: vi.fn(() => 0.1),
    };

    updateStatusLine(state);

    expect(applyGradientSweepMock).toHaveBeenCalledWith('60/120k↓', 0.25, '#3b82f6', 0.1);
  });

  it('does not animate the model name while the agent runs', () => {
    const state = createState();
    state.gradientAnimator = {
      isRunning: vi.fn(() => true),
      getOffset: vi.fn(() => 0.5),
      getFadeProgress: vi.fn(() => 0),
    };

    updateStatusLine(state);

    expect(applyGradientSweepMock).not.toHaveBeenCalled();
  });
});
