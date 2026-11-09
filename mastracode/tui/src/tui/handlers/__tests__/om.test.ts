import { Container, Text } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import { isChatBoundarySpacer } from '../../components/chat-boundary-spacer.js';
import type { TUIState } from '../../state.js';
import { handleOMActivation, handleOMBufferingStart, handleOMObservationEnd, handleOMObservationStart } from '../om.js';
import type { EventHandlerContext } from '../types.js';

function createCtx() {
  const state = {
    chatContainer: new Container(),
    ui: { requestRender: vi.fn() },
  } as unknown as TUIState;

  const ctx = { state } as EventHandlerContext;

  return { ctx, state };
}

describe('OM event handlers', () => {
  it('starts a new buffering cycle without adding a chat marker', () => {
    const { ctx, state } = createCtx();
    state.activeActivationMarker = new Container() as any;
    state.activeActivationData = {} as any;

    handleOMBufferingStart(ctx);

    expect(state.activeActivationMarker).toBeUndefined();
    expect(state.activeActivationData).toBeUndefined();
    expect(state.chatContainer.children).toHaveLength(0);
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('preserves completed text caches when replacing an observation marker', () => {
    const { ctx, state } = createCtx();
    const completed = new Text('completed history', 0, 0);
    state.chatContainer.addChild(completed);
    const cachedLines = completed.render(80);

    handleOMObservationStart(ctx, 'cycle-1', 100);
    handleOMObservationEnd(ctx, 'cycle-1', 25, 100, 20, 'observed');

    expect(completed.render(80)).toBe(cachedLines);
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
