import { Container } from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import type { TUIState } from '../../state.js';
import { handleOMBufferingStart } from '../om.js';
import type { EventHandlerContext } from '../types.js';

function createContext(): EventHandlerContext {
  const chatContainer = new Container();
  const state = {
    chatContainer,
    quietMode: true,
    ui: { requestRender: vi.fn() },
  } as unknown as TUIState;

  return { state } as EventHandlerContext;
}

describe('OM event handlers', () => {
  it('removes an existing buffering marker when quiet mode suppresses buffering start', () => {
    const ctx = createContext();
    const marker = new Container();
    ctx.state.chatContainer.addChild(marker);
    ctx.state.activeBufferingMarker = marker as any;

    handleOMBufferingStart(ctx, 'observation', 100);

    expect(ctx.state.activeBufferingMarker).toBeUndefined();
    expect(ctx.state.chatContainer.children).not.toContain(marker);
    expect(ctx.state.ui.requestRender).toHaveBeenCalled();
  });
});
