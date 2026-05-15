import { Container } from '@mariozechner/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import type { TUIState } from '../../state.js';
import { handleOMActivation } from '../om.js';
import type { EventHandlerContext } from '../types.js';

function createCtx() {
  const state = {
    chatContainer: new Container(),
    ui: { requestRender: vi.fn() },
  } as unknown as TUIState;

  const ctx = { state } as EventHandlerContext;

  return { ctx, state };
}

describe('handleOMActivation', () => {
  it('combines consecutive observation activation markers into one line', () => {
    const { ctx, state } = createCtx();

    handleOMActivation(ctx, 'observation', 7_300, 400);
    handleOMActivation(ctx, 'observation', 2_000, 125);

    expect(state.chatContainer.children).toHaveLength(1);
    const text = stripAnsi(state.chatContainer.render(120).join('\n'));
    expect(text).toContain('Activated 2 observations: -9.3k msg tokens, +0.5k obs tokens');
  });

  it('does not combine activations separated by another marker', () => {
    const { ctx, state } = createCtx();

    handleOMActivation(ctx, 'observation', 7_300, 400);
    state.chatContainer.addChild(new Container());
    handleOMActivation(ctx, 'observation', 2_000, 125);

    expect(state.chatContainer.children).toHaveLength(3);
  });
});
