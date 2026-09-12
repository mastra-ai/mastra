/**
 * Unit tests for the pack-fallback stickiness handler: the thread pack switch
 * triggered by a `data-mastracode-pack-fallback` hop.
 */

import { describe, expect, it, vi } from 'vitest';

import { handlePackFallbackState } from './message.js';
import type { EventHandlerContext } from './types.js';

const KEY = 'mastracodePendingPackFallback';

function makeContext() {
  const stateSet = vi.fn(async () => {});
  const threadSetSetting = vi.fn(async () => {});
  const modelSwitch = vi.fn(async () => {});
  const ectx = {
    state: {
      session: {
        state: { set: stateSet },
        thread: { getId: () => 'thread-1', setSetting: threadSetSetting },
        model: { switch: modelSwitch },
      },
    },
    updateStatusLine: vi.fn(),
    refreshModelAuthStatus: vi.fn(async () => {}),
  } as unknown as EventHandlerContext;
  return { ectx, stateSet, threadSetSetting, modelSwitch };
}

describe('handlePackFallbackState', () => {
  it('ignores events that do not touch the pack-fallback key', async () => {
    const { ectx, stateSet } = makeContext();
    await handlePackFallbackState(ectx, { state: {}, changedKeys: ['someOtherKey'] });
    expect(stateSet).not.toHaveBeenCalled();
  });

  it('returns early on a null payload WITHOUT clearing — clearing would re-emit state_changed and loop', async () => {
    const { ectx, stateSet, threadSetSetting, modelSwitch } = makeContext();
    await handlePackFallbackState(ectx, { state: { [KEY]: null }, changedKeys: [KEY] });
    expect(stateSet).not.toHaveBeenCalled();
    expect(threadSetSetting).not.toHaveBeenCalled();
    expect(modelSwitch).not.toHaveBeenCalled();
  });

  it('consumes (clears) a malformed payload without switching packs', async () => {
    const { ectx, stateSet, modelSwitch } = makeContext();
    await handlePackFallbackState(ectx, { state: { [KEY]: { reason: 'pool-exhausted' } }, changedKeys: [KEY] });
    expect(stateSet).toHaveBeenCalledWith({ [KEY]: null });
    expect(modelSwitch).not.toHaveBeenCalled();
  });
});
