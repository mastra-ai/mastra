import { describe, expect, it, vi } from 'vitest';

import { applyOMModelToSession } from './om-defaults.js';
import type { TUIState } from './state.js';

function stateFixture() {
  const observerSwitch = vi.fn(async () => {});
  const reflectorSwitch = vi.fn(async () => {});
  return {
    observerSwitch,
    reflectorSwitch,
    state: {
      session: {
        om: {
          observer: { switchModel: observerSwitch },
          reflector: { switchModel: reflectorSwitch },
        },
      },
    } as unknown as TUIState,
  };
}

describe('applyOMModelToSession', () => {
  it('pins both roles to the model the user chose during onboarding', async () => {
    const { state, observerSwitch, reflectorSwitch } = stateFixture();

    await applyOMModelToSession(state, 'anthropic/claude-haiku-4-5');

    expect(observerSwitch).toHaveBeenCalledExactlyOnceWith({ modelId: 'anthropic/claude-haiku-4-5' });
    expect(reflectorSwitch).toHaveBeenCalledExactlyOnceWith({ modelId: 'anthropic/claude-haiku-4-5' });
  });
});
