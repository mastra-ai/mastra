import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  dispatchEvent: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showFormattedError: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('node:child_process', () => ({
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
    caffeinateProcess: MockChildProcess | null;
    getEventContext: ReturnType<typeof vi.fn>;
    showHookWarnings: ReturnType<typeof vi.fn>;
    runUserPromptHook: (input: string) => Promise<boolean>;
    handleEvent: (event: unknown) => Promise<void>;
    stop: () => void;
  };

  tui.state = { hookManager, ui: { stop: vi.fn() } };
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
    const tui = createBareTui({ runStop });

    await tui.handleEvent({ type: 'agent_end', reason });

    expect(mocks.dispatchEvent).toHaveBeenCalledWith({ type: 'agent_end', reason }, {}, tui.state);
    expect(runStop).toHaveBeenCalledWith(undefined, expectedStopReason);
  });

  it('does not run Stop hook for non-agent_end events', async () => {
    const runStop = vi.fn().mockResolvedValue(createHookResult());
    const tui = createBareTui({ runStop });

    await tui.handleEvent({ type: 'agent_start' });

    expect(runStop).not.toHaveBeenCalled();
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
});
