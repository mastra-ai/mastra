import { describe, expect, it } from 'vitest';

import { Harness } from './harness';
import type { HarnessMode } from './types';

describe('Harness mode validation', () => {
  it('types each mode as either replacing or augmenting tools', () => {
    const replaceToolsMode: HarnessMode = { id: 'replace-tools', tools: {} };
    const augmentToolsMode: HarnessMode = { id: 'augment-tools', additionalTools: {} };
    // @ts-expect-error modes cannot replace and augment tools at the same time
    const invalidToolsMode: HarnessMode = { id: 'invalid-tools', tools: {}, additionalTools: {} };

    expect([replaceToolsMode.id, augmentToolsMode.id, invalidToolsMode.id]).toEqual([
      'replace-tools',
      'augment-tools',
      'invalid-tools',
    ]);
  });

  it('rejects duplicate mode ids before they can corrupt the mode agent cache', () => {
    expect(
      () =>
        new Harness({
          id: 'test-harness',
          modes: [
            { id: 'build', defaultModelId: 'test/build-model' },
            { id: 'build', defaultModelId: 'test/other-model' },
          ],
        }),
    ).toThrow('Duplicate mode id "build" found when creating the Harness');
  });

  it('rejects modes that both replace and augment tools', () => {
    expect(
      () =>
        new Harness({
          id: 'test-harness',
          modes: [
            {
              id: 'build',
              defaultModelId: 'test/build-model',
              tools: {},
              additionalTools: {},
            } as any,
          ],
        }),
    ).toThrow('Mode "build" cannot set both "tools" and "additionalTools" - choose replace OR augment');
  });

  it('rejects transitionsTo values that do not reference an existing mode', () => {
    expect(
      () =>
        new Harness({
          id: 'test-harness',
          modes: [
            { id: 'plan', defaultModelId: 'test/plan-model', transitionsTo: 'build' },
            { id: 'fast', defaultModelId: 'test/fast-model' },
          ],
        }),
    ).toThrow('Mode "plan" transitionsTo references unknown mode "build"');
  });

  it('rejects modes that transition to themselves', () => {
    expect(
      () =>
        new Harness({
          id: 'test-harness',
          modes: [{ id: 'plan', defaultModelId: 'test/plan-model', transitionsTo: 'plan' }],
        }),
    ).toThrow('Mode "plan" transitionsTo cannot reference itself');
  });
});
