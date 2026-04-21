import { Container } from '@mariozechner/pi-tui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OMMarkerComponent } from '../../components/om-marker.js';
import { OMOutputComponent } from '../../components/om-output.js';
import type { TUIState } from '../../state.js';
import { handleOMActivation, handleOMConciseHistory } from '../om.js';
import type { EventHandlerContext } from '../types.js';

vi.mock('chalk', () => {
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        if (['hex', 'bgHex', 'rgb', 'bgRgb'].includes(prop as string)) return () => makeChain();
        return makeChain();
      },
    });

  return { default: makeChain() };
});

vi.mock('../../theme.js', () => ({
  BOX_INDENT: 0,
  getTermWidth: () => 80,
  mastra: {
    orange: '#f59e0b',
    red: '#ef4444',
    green: '#22c55e',
    specialGray: '#9ca3af',
    mainGray: '#6b7280',
    muted: '#6b7280',
  },
  theme: {
    fg: (_tone: string, value: string) => value,
  },
}));

describe('OM activation handlers', () => {
  let state: TUIState;
  let ctx: EventHandlerContext;

  beforeEach(() => {
    state = {
      chatContainer: new Container(),
      ui: { requestRender: vi.fn() },
    } as unknown as TUIState;

    ctx = {
      state,
    } as EventHandlerContext;
  });

  it('adds an activation marker for observation activations', () => {
    handleOMActivation(ctx, 'observation', 7300, 400, 'threshold');

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(OMMarkerComponent);
    expect(state.activeActivationMarker).toBe(state.chatContainer.children[0]);
    expect(state.activeBufferingMarker).toBeUndefined();
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('adds a concise-history output when concise history arrives', () => {
    handleOMConciseHistory(ctx, 'a\nb');

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(OMOutputComponent);
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('does not attach concise-history output to reflection activations', () => {
    handleOMActivation(ctx, 'reflection', 19340, 17077, 'threshold');

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(OMMarkerComponent);
  });
});
