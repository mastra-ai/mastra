import { describe, expect, it, vi } from 'vitest';

import { MastraTUI } from '../mastra-tui.js';

function createTui() {
  const editor = {
    onSubmit: undefined as ((text: string) => void) | undefined,
    addToHistory: vi.fn(),
    setText: vi.fn(),
  };
  const tui = Object.create(MastraTUI.prototype) as any;
  tui.queuedUserInput = [];
  tui.pendingUserInputResolve = undefined;
  tui.state = {
    editor,
    session: { run: { isRunning: () => false } },
  };
  return { tui, editor };
}

describe('MastraTUI user input handoff', () => {
  it('resolves the pending read with the submitted text', async () => {
    const { tui, editor } = createTui();

    const input = tui.getUserInput() as Promise<string>;
    editor.onSubmit!('hello');

    await expect(input).resolves.toBe('hello');
  });

  it('delivers text submitted while the loop was busy on the next read', async () => {
    const { tui, editor } = createTui();

    // First read completes, mirroring a command the loop is now off handling.
    const first = tui.getUserInput() as Promise<string>;
    editor.onSubmit!('!echo hi');
    await expect(first).resolves.toBe('!echo hi');

    // Submitted before the loop comes back around to read again.
    editor.onSubmit!('/browser clear viewport');

    await expect(tui.getUserInput()).resolves.toBe('/browser clear viewport');
  });

  it('preserves the order of several submissions made while busy', async () => {
    const { tui, editor } = createTui();

    const first = tui.getUserInput() as Promise<string>;
    editor.onSubmit!('one');
    await first;

    editor.onSubmit!('two');
    editor.onSubmit!('three');

    await expect(tui.getUserInput()).resolves.toBe('two');
    await expect(tui.getUserInput()).resolves.toBe('three');
  });
});
