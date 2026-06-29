import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  dispatchEvent: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showFormattedError: vi.fn(),
  notify: vi.fn(),
  updateStatusLine: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  spawn: mocks.mockSpawn,
}));

vi.mock('../event-dispatch.js', () => ({
  dispatchEvent: mocks.dispatchEvent,
}));

vi.mock('../display.js', () => ({
  showError: mocks.showError,
  showInfo: mocks.showInfo,
  showFormattedError: mocks.showFormattedError,
  notify: mocks.notify,
}));

vi.mock('../status-line.js', () => ({
  updateStatusLine: mocks.updateStatusLine,
}));

import { MastraTUI } from '../mastra-tui.js';

function createHookResult(overrides: Record<string, unknown> = {}) {
  return {
    allowed: true,
    results: [],
    warnings: [],
    ...overrides,
  };
}

function createBareTui(hookManager?: Record<string, unknown>) {
  const tui = Object.create(MastraTUI.prototype) as {
    state: Record<string, unknown>;
    statusTimingTimer: ReturnType<typeof setInterval> | null;
    caffeinateProcess: MockChildProcess | null;
    getEventContext: ReturnType<typeof vi.fn>;
    showHookWarnings: ReturnType<typeof vi.fn>;
    runUserPromptHook: (input: string) => Promise<boolean>;
    handleEvent: (event: unknown) => Promise<void>;
    stop: () => void;
  };

  tui.state = {
    hookManager,
    ui: { stop: vi.fn(), requestRender: vi.fn() },
    idleCounter: { setTimingState: vi.fn(), update: vi.fn() },
  };
  tui.statusTimingTimer = null;
  tui.caffeinateProcess = null;
  tui.getEventContext = vi.fn(() => ({}));
  tui.showHookWarnings = vi.fn();

  return tui;
}

class MockChildProcess extends EventEmitter {
  kill = vi.fn();
}

describe('MastraTUI hook wiring', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mockFn => mockFn.mockReset());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('blocks non-command prompt when UserPromptSubmit blocks', async () => {
    const runUserPromptSubmit = vi
      .fn()
      .mockResolvedValue(createHookResult({ allowed: false, blockReason: 'blocked by test', warnings: ['warn'] }));
    const tui = createBareTui({ runUserPromptSubmit });

    const allowed = await tui.runUserPromptHook('hello');

    expect(allowed).toBe(false);
    expect(runUserPromptSubmit).toHaveBeenCalledWith('hello');
    expect(tui.showHookWarnings).toHaveBeenCalledWith('UserPromptSubmit', ['warn']);
    expect(mocks.showError).toHaveBeenCalledWith(tui.state, 'blocked by test');
  });

  it('allows non-command prompt when UserPromptSubmit allows', async () => {
    const runUserPromptSubmit = vi.fn().mockResolvedValue(createHookResult({ warnings: ['warn'] }));
    const tui = createBareTui({ runUserPromptSubmit });

    const allowed = await tui.runUserPromptHook('hello');

    expect(allowed).toBe(true);
    expect(runUserPromptSubmit).toHaveBeenCalledWith('hello');
    expect(tui.showHookWarnings).toHaveBeenCalledWith('UserPromptSubmit', ['warn']);
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it.each([
    ['aborted', 'aborted'],
    ['error', 'error'],
    ['complete', 'complete'],
    [undefined, 'complete'],
  ] as const)('runs Stop hook on agent_end reason=%s', async (reason, expectedStopReason) => {
    const runStop = vi.fn().mockResolvedValue(createHookResult());
    const runAgentEnd = vi.fn().mockResolvedValue(createHookResult());
    const clearRunId = vi.fn();
    const tui = createBareTui({ runStop, runAgentEnd, clearRunId });

    await tui.handleEvent({ type: 'agent_end', reason });

    expect(mocks.dispatchEvent).toHaveBeenCalledWith({ type: 'agent_end', reason }, {}, tui.state);
    expect(runAgentEnd).toHaveBeenCalledWith(reason ?? 'complete');
    expect(runStop).toHaveBeenCalledWith(undefined, expectedStopReason);
    expect(clearRunId).toHaveBeenCalledTimes(1);
  });

  it('does not run Stop hook for non-agent_end events', async () => {
    const runStop = vi.fn().mockResolvedValue(createHookResult());
    const runAgentStart = vi.fn().mockResolvedValue(createHookResult());
    const setRunId = vi.fn();
    const tui = createBareTui({ runStop, runAgentStart, setRunId });

    await tui.handleEvent({ type: 'agent_start' });

    expect(runStop).not.toHaveBeenCalled();
    expect(setRunId).toHaveBeenCalledTimes(1);
    expect(runAgentStart).toHaveBeenCalledTimes(1);
  });

  it('ticks idle status line every second while an agent run is active', async () => {
    vi.useFakeTimers();
    try {
      mocks.dispatchEvent.mockImplementation(async (_event, _ctx, state) => {
        state.agentRunStartedAt = Date.now();
      });
      const tui = createBareTui();

      await tui.handleEvent({ type: 'agent_start' });
      expect((tui.state.idleCounter as any).setTimingState).toHaveBeenCalledWith(tui.state, expect.any(Number));
      (tui.state.idleCounter as any).setTimingState.mockClear();

      vi.advanceTimersByTime(1_000);
      expect((tui.state.idleCounter as any).setTimingState).toHaveBeenCalledWith(tui.state, expect.any(Number));
    } finally {
      vi.useRealTimers();
    }
  });

  it('ticks idle status line every minute after an agent run ends', async () => {
    vi.useFakeTimers();
    try {
      mocks.dispatchEvent.mockImplementation(async (_event, _ctx, state) => {
        state.lastAgentRunDurationMs = 1_000;
        state.lastAgentRunEndedAt = Date.now();
      });
      const tui = createBareTui();

      await tui.handleEvent({ type: 'agent_end', reason: 'complete' });
      expect((tui.state.idleCounter as any).setTimingState).toHaveBeenCalledWith(tui.state, expect.any(Number));
      (tui.state.idleCounter as any).setTimingState.mockClear();

      vi.advanceTimersByTime(60_000);
      expect((tui.state.idleCounter as any).setTimingState).toHaveBeenCalledWith(tui.state, expect.any(Number));
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts caffeinate on macOS agent_start', async () => {
    vi.stubGlobal('process', { platform: 'darwin', env: {} });
    const child = new MockChildProcess();
    mocks.mockSpawn.mockReturnValue(child);
    const tui = createBareTui();

    await tui.handleEvent({ type: 'agent_start' });

    expect(mocks.mockSpawn).toHaveBeenCalledWith('caffeinate', ['-i', '-m'], { stdio: 'ignore' });
    expect(tui.caffeinateProcess).toBe(child);
  });

  it('does not start duplicate caffeinate processes', async () => {
    vi.stubGlobal('process', { platform: 'darwin', env: {} });
    const child = new MockChildProcess();
    mocks.mockSpawn.mockReturnValue(child);
    const tui = createBareTui();

    await tui.handleEvent({ type: 'agent_start' });
    await tui.handleEvent({ type: 'agent_start' });

    expect(mocks.mockSpawn).toHaveBeenCalledTimes(1);
    expect(tui.caffeinateProcess).toBe(child);
  });

  it.each(['aborted', 'error', 'complete'] as const)('stops caffeinate on agent_end reason=%s', async reason => {
    vi.stubGlobal('process', { platform: 'darwin', env: {} });
    const child = new MockChildProcess();
    mocks.mockSpawn.mockReturnValue(child);
    const tui = createBareTui();

    await tui.handleEvent({ type: 'agent_start' });
    await tui.handleEvent({ type: 'agent_end', reason });

    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(tui.caffeinateProcess).toBeNull();
  });

  it('cleans up caffeinate on stop()', () => {
    vi.stubGlobal('process', { platform: 'darwin', env: {} });
    const runSessionEnd = vi.fn().mockResolvedValue(createHookResult());
    const child = new MockChildProcess();
    const tui = createBareTui({ runSessionEnd });
    tui.caffeinateProcess = child;

    tui.stop();

    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(runSessionEnd).toHaveBeenCalledTimes(1);
    expect((tui.state.ui as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalledTimes(1);
    expect(tui.caffeinateProcess).toBeNull();
  });

  it('does nothing on non-darwin platforms', async () => {
    vi.stubGlobal('process', { platform: 'linux', env: {} });
    const tui = createBareTui();

    await tui.handleEvent({ type: 'agent_start' });

    expect(mocks.mockSpawn).not.toHaveBeenCalled();
    expect(tui.caffeinateProcess).toBeNull();
  });

  it('does not start caffeinate when disabled by env var', async () => {
    vi.stubGlobal('process', { platform: 'darwin', env: { MASTRACODE_DISABLE_CAFFEINATE: '1' } });
    const tui = createBareTui();

    await tui.handleEvent({ type: 'agent_start' });

    expect(mocks.mockSpawn).not.toHaveBeenCalled();
    expect(tui.caffeinateProcess).toBeNull();
  });

  it('generates a run_id and sets it before firing AgentStart on agent_start', async () => {
    const setRunId = vi.fn();
    const runAgentStart = vi.fn().mockResolvedValue(createHookResult());
    const tui = createBareTui({ setRunId, runAgentStart });

    await tui.handleEvent({ type: 'agent_start' });

    expect(setRunId).toHaveBeenCalledTimes(1);
    const runId = setRunId.mock.calls[0][0] as string;
    expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(runAgentStart).toHaveBeenCalledTimes(1);
  });

  it('fires AgentEnd before clearing run_id on agent_end', async () => {
    const runAgentEnd = vi.fn().mockResolvedValue(createHookResult());
    const runStop = vi.fn().mockResolvedValue(createHookResult());
    const clearRunId = vi.fn();
    const tui = createBareTui({ runAgentEnd, runStop, clearRunId });

    await tui.handleEvent({ type: 'agent_end', reason: 'suspended' });

    expect(runAgentEnd).toHaveBeenCalledWith('suspended');
    expect(runStop).toHaveBeenCalledWith(undefined, 'complete');
    // AgentEnd must be called before clearRunId
    expect(runAgentEnd.mock.invocationCallOrder[0]).toBeLessThan(clearRunId.mock.invocationCallOrder[0]);
  });

  it('fires PermissionRequest on tool_approval_required with tool context', async () => {
    const runPermissionRequest = vi.fn().mockResolvedValue(createHookResult());
    const tui = createBareTui({ runPermissionRequest });

    await tui.handleEvent({
      type: 'tool_approval_required',
      toolCallId: 'call-1',
      toolName: 'execute_command',
      args: { command: 'rm -rf /' },
    });

    expect(runPermissionRequest).toHaveBeenCalledWith('tool_approval', 'call-1', 'execute_command', {
      command: 'rm -rf /',
    });
  });

  it('fires SubagentStart on subagent_start with delegation context', async () => {
    const runSubagentStart = vi.fn().mockResolvedValue(createHookResult());
    const tui = createBareTui({ runSubagentStart });

    await tui.handleEvent({
      type: 'subagent_start',
      toolCallId: 'call-2',
      agentType: 'execute',
      task: 'run tests',
      modelId: 'gpt-4o',
      forked: true,
    });

    expect(runSubagentStart).toHaveBeenCalledWith('call-2', 'execute', 'run tests', 'gpt-4o', true);
  });

  it('fires SubagentEnd on subagent_end with result context', async () => {
    const runSubagentEnd = vi.fn().mockResolvedValue(createHookResult());
    const tui = createBareTui({ runSubagentEnd });

    await tui.handleEvent({
      type: 'subagent_end',
      toolCallId: 'call-2',
      agentType: 'execute',
      result: 'all tests passed',
      isError: false,
      durationMs: 1234,
    });

    expect(runSubagentEnd).toHaveBeenCalledWith('call-2', 'execute', 'all tests passed', false, 1234);
  });

  it('does not fire lifecycle hooks when no hookManager is configured', async () => {
    const tui = createBareTui();

    await tui.handleEvent({ type: 'tool_approval_required', toolCallId: 'c', toolName: 't', args: {} });
    await tui.handleEvent({ type: 'subagent_start', toolCallId: 'c', agentType: 'a', task: 't' });
    await tui.handleEvent({
      type: 'subagent_end',
      toolCallId: 'c',
      agentType: 'a',
      result: '',
      isError: false,
      durationMs: 0,
    });

    // Should not throw — no hookManager means no lifecycle hook calls
    expect(mocks.dispatchEvent).toHaveBeenCalledTimes(3);
  });
});
