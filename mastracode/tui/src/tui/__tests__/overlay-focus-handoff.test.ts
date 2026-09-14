import { describe, expect, it, vi } from 'vitest';
import { installOverlayFocusHandoff } from '../setup.js';

// Regression tests for #21139: when a plan approval defers its focus because a
// command overlay (e.g. the model pack selector) is open, closing the overlay
// must hand focus to the pending approval. The seam is a transparent wrapper
// around `state.ui.hideOverlay` installed at setup time
// (installOverlayFocusHandoff in setup.ts).

function createUi() {
  const overlays: string[] = [];
  const ui = {
    overlays,
    setFocus: vi.fn(),
    hasOverlay: vi.fn(() => overlays.length > 0),
    hideOverlay: vi.fn(() => {
      overlays.pop();
    }),
  };
  return ui;
}

function createState(ui: ReturnType<typeof createUi>) {
  const approval = { kind: 'plan-approval' };
  return {
    ui,
    editor: {},
    activeInlinePlanApproval: approval as any,
    pendingFocus: approval as any,
  };
}

const install: (ui: any, state: any) => void = installOverlayFocusHandoff;

describe('installOverlayFocusHandoff (#21139)', () => {
  it('hands focus to the pending approval when the overlay stack empties', async () => {
    const ui = createUi();
    ui.overlays.push('model-pack');
    const state = createState(ui);
    install(ui, state);

    state.ui.hideOverlay();

    expect(ui.overlays).toHaveLength(0);
    expect(ui.setFocus).toHaveBeenCalledWith(state.activeInlinePlanApproval);
    expect(state.pendingFocus).toBeUndefined();
  });

  it('does not hand off while deeper overlays remain (stacked overlays)', async () => {
    const ui = createUi();
    ui.overlays.push('model-pack', 'permission-modal');
    const state = createState(ui);
    install(ui, state);

    state.ui.hideOverlay();
    expect(ui.setFocus).not.toHaveBeenCalled();
    expect(state.pendingFocus).toBe(state.activeInlinePlanApproval);

    state.ui.hideOverlay();
    expect(ui.setFocus).toHaveBeenCalledWith(state.activeInlinePlanApproval);
    expect(state.pendingFocus).toBeUndefined();
  });

  it('ignores a stale pendingFocus after the approval was dismissed (Ctrl+C paths)', async () => {
    const ui = createUi();
    ui.overlays.push('model-pack');
    const state = createState(ui);
    install(ui, state);

    // setup.ts Ctrl+C / abort paths clear activeInlinePlanApproval outside the
    // three resolution handlers; the hand-off must be guarded by
    // pendingFocus === activeInlinePlanApproval, not a bare null check.
    state.activeInlinePlanApproval = undefined;

    state.ui.hideOverlay();

    expect(ui.setFocus).not.toHaveBeenCalled();
    expect(state.pendingFocus).toBeUndefined();
  });

  it('stays transparent: the original hideOverlay still runs and pops the stack', async () => {
    const ui = createUi();
    ui.overlays.push('model-pack');
    const state = createState(ui);
    state.pendingFocus = undefined;
    install(ui, state);

    state.ui.hideOverlay();

    expect(ui.overlays).toHaveLength(0);
    expect(ui.setFocus).not.toHaveBeenCalled();
  });
});
