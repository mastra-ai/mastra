import { Container } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import { isChatBoundarySpacer } from '../../components/chat-boundary-spacer';
import type { TUIState } from '../../state';
import { handleOMActivation, handleOMBufferingStart } from '../om';
import type { EventHandlerContext } from '../types';

function createCtx() {
  const state = {
    chatContainer: new Container(),
    ui: { requestRender: vi.fn() },
  } as unknown as TUIState;

  const ctx = { state } as EventHandlerContext;

  return { ctx, state };
}

describe('OM event handlers', () => {
  it('removes an existing buffering marker when quiet mode suppresses buffering start', () => {
    const { ctx, state } = createCtx();
    state.quietMode = true;
    const marker = new Container();
    state.chatContainer.addChild(marker);
    state.activeBufferingMarker = marker as any;

    handleOMBufferingStart(ctx, 'observation', 100);

    expect(state.activeBufferingMarker).toBeUndefined();
    expect(state.chatContainer.children).not.toContain(marker);
    expect(state.ui.requestRender).toHaveBeenCalled();
  });
});

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

    // 4 children: OMMarker, Container, boundary-spacer (above 2nd OMMarker), OMMarker
    expect(state.chatContainer.children).toHaveLength(4);
  });

  it('coalesces consecutive activations when a streaming component is present', () => {
    const { ctx, state } = createCtx();

    // Simulate a streaming assistant message at the end of the container
    const streamingComponent = new Container();
    state.chatContainer.addChild(streamingComponent);
    state.streamingComponent = streamingComponent as any;

    handleOMActivation(ctx, 'observation', 7_300, 400);
    handleOMActivation(ctx, 'observation', 2_000, 125);

    // Should coalesce into a single marker despite boundary spacers
    const nonSpacerChildren = state.chatContainer.children.filter(c => !isChatBoundarySpacer(c));
    // 2 real children: the coalesced OMMarker + the streaming component
    expect(nonSpacerChildren).toHaveLength(2);
    const text = stripAnsi(state.chatContainer.render(120).join('\n'));
    expect(text).toContain('Activated 2 observations');
  });
});
