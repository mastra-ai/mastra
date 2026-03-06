import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatchEvent: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showFormattedError: vi.fn(),
  notify: vi.fn(),
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
    getEventContext: ReturnType<typeof vi.fn>;
    showHookWarnings: ReturnType<typeof vi.fn>;
    runUserPromptHook: (input: string) => Promise<boolean>;
    handleEvent: (event: unknown) => Promise<void>;
  };

  tui.state = { hookManager };
  tui.getEventContext = vi.fn(() => ({}));
  tui.showHookWarnings = vi.fn();

  return tui;
}

describe('MastraTUI hook wiring', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mockFn => mockFn.mockReset());
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
});
