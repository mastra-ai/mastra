/**
 * Harness v1 — listModes() / getMode() coverage.
 *
 * Both are thin enumerators over the mode map declared in `HarnessConfig`,
 * but they're the entry point a TUI uses to render a mode picker, and a
 * script uses to discover what modes exist before calling `harness.session`.
 * If they ever drift from the declared order or stop surfacing `metadata`
 * passthroughs, downstream UIs lose information silently.
 */

import { describe, expect, it } from 'vitest';

import { MockAgent } from './__test-utils__/mock-agent';
import { setupHarness } from './__test-utils__/setup';
import type { HarnessMode } from './types';

describe('Harness.listModes()', () => {
  it('returns every registered mode in declaration order', () => {
    const modes: HarnessMode[] = [
      { id: 'build', agentId: 'default' },
      { id: 'plan', agentId: 'default' },
      { id: 'fast', agentId: 'default' },
    ];
    const { harness } = setupHarness({ modes, defaultModeId: 'build' });

    expect(harness.listModes().map(m => m.id)).toEqual(['build', 'plan', 'fast']);
  });

  it('returns a fresh array — callers cannot mutate harness state', () => {
    const { harness } = setupHarness();

    const a = harness.listModes();
    const b = harness.listModes();
    expect(a).not.toBe(b);

    a.length = 0;
    expect(harness.listModes()).toHaveLength(1);
  });

  it('preserves passthrough fields (metadata, instructions, additionalTools)', () => {
    const modes: HarnessMode[] = [
      {
        id: 'build',
        agentId: 'default',
        description: 'Build mode',
        instructions: 'You are in build mode.',
        metadata: { color: '#abcdef' },
      },
    ];
    const { harness } = setupHarness({ modes });

    const [build] = harness.listModes();
    expect(build).toMatchObject({
      id: 'build',
      agentId: 'default',
      description: 'Build mode',
      instructions: 'You are in build mode.',
      metadata: { color: '#abcdef' },
    });
  });
});

describe('Harness.getMode()', () => {
  it('returns the mode object for a known id', () => {
    const modes: HarnessMode[] = [
      { id: 'build', agentId: 'default' },
      { id: 'plan', agentId: 'default' },
    ];
    const { harness } = setupHarness({ modes, defaultModeId: 'build' });

    expect(harness.getMode('plan')).toMatchObject({ id: 'plan', agentId: 'default' });
  });

  it('returns undefined for an unknown id (no throw)', () => {
    const { harness } = setupHarness();

    expect(harness.getMode('does-not-exist')).toBeUndefined();
  });

  it('returns the same reference as the entry inside listModes()', () => {
    const { harness } = setupHarness({
      agents: { default: new MockAgent({ id: 'default' }) },
      modes: [{ id: 'build', agentId: 'default' }],
    });

    const fromList = harness.listModes().find(m => m.id === 'build');
    const fromGet = harness.getMode('build');
    expect(fromGet).toBe(fromList);
  });
});
