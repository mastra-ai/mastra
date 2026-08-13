import { describe, expect, it, vi } from 'vitest';

import { applyProviderOMDefaultIfUnconfigured } from './om-defaults.js';
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
          observer: { switchSelection: observerSwitch },
          reflector: { switchSelection: reflectorSwitch },
        },
      },
    } as unknown as TUIState,
  };
}

describe('applyProviderOMDefaultIfUnconfigured', () => {
  it.each(['openai-codex', 'anthropic', 'google', 'github-copilot'])(
    'keeps auto OM intent unmaterialized after %s connects',
    async providerId => {
      const { state, observerSwitch, reflectorSwitch } = stateFixture();

      await expect(applyProviderOMDefaultIfUnconfigured(state, providerId)).resolves.toBeUndefined();
      expect(observerSwitch).not.toHaveBeenCalled();
      expect(reflectorSwitch).not.toHaveBeenCalled();
    },
  );
});
