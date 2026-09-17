import { describe, expect, it, vi } from 'vitest';

import { EmulatedTerminal } from '../../../e2e/terminal-backend.js';

describe('EmulatedTerminal input lifecycle', () => {
  it('discards input queued before a restart', async () => {
    const terminal = new EmulatedTerminal(80, 24);
    const firstInput = vi.fn();
    terminal.start(firstInput, vi.fn());

    terminal.sendInput('stale-a');
    terminal.sendInput('stale-b');
    terminal.stop();

    const restartedInput = vi.fn();
    terminal.start(restartedInput, vi.fn());
    await terminal.flushInput();

    expect(firstInput).not.toHaveBeenCalled();
    expect(restartedInput).not.toHaveBeenCalled();

    terminal.sendInput('current');
    await terminal.flushInput();

    expect(restartedInput.mock.calls.flat().join('')).toBe('current');
    terminal.stop();
  });
});
