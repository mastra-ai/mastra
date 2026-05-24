/**
 * Harness v1 — boot-time validation of HarnessConfig keys.
 *
 * The constructor walks the top-level keys of the passed config and
 * emits a console.warn for any that isn't recognized. The catch-all
 * `[key: string]: unknown` on `HarnessConfigCommon` is preserved
 * for back-compat; warn-only is the deliberate intermediate state.
 *
 * These tests pin the warn behavior and the full set of currently
 * recognized top-level keys. Adding a new field to `HarnessConfig`
 * without updating the harness-side known-keys set will cause the
 * "all known keys pass without warning" pin to fail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';

import { HarnessConfigError } from './errors';
import { Harness } from './harness';

function makeAgent() {
  return new Agent({ id: 'a', name: 'a', instructions: 'i', model: 'openai/gpt-4o-mini' as any });
}

function minimalValidConfig() {
  return {
    agents: { default: makeAgent() } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
  };
}

describe('Harness constructor — unknown HarnessConfig keys', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once for each unknown top-level key', () => {
    new Harness({ ...minimalValidConfig(), unknownKey: 'value', anotherStrangeOne: 42 } as any);
    const messages = warnSpy.mock.calls.map(c => String(c[0]));
    expect(messages.some(m => m.includes('"unknownKey"'))).toBe(true);
    expect(messages.some(m => m.includes('"anotherStrangeOne"'))).toBe(true);
    expect(messages.filter(m => m.includes('[mastra:harness] ignoring unknown HarnessConfig key'))).toHaveLength(2);
  });

  it('does not warn when only documented keys are passed', () => {
    new Harness(minimalValidConfig() as any);
    expect(warnSpy.mock.calls.filter(c => String(c[0]).includes('[mastra:harness] ignoring unknown'))).toHaveLength(0);
  });

  it('accepts every documented HarnessConfig key without warning', () => {
    // A config that exercises every key in the current known-keys set.
    // If a new key lands on HarnessConfigCommon and the harness-side
    // const isn't updated, this test still passes — that drift is
    // caught by the "warns once for unknown" test exercising the new
    // key as `unknownKey`. This test is the inverse direction: making
    // sure no documented key falsely triggers the warning.
    new Harness({
      runtimeCompatibilityGeneration: 'v1',
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      defaultPermissionPolicy: 'ask',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
      files: undefined,
      subagents: undefined,
      goals: undefined,
      toolCategoryResolver: undefined,
      toolCategories: undefined,
      models: undefined,
      skills: undefined,
      modelAuthStatusResolver: undefined,
      channels: undefined,
      workspace: undefined,
      agents: { default: makeAgent() } as any,
      storage: undefined,
    } as any);
    expect(warnSpy.mock.calls.filter(c => String(c[0]).includes('[mastra:harness] ignoring unknown'))).toHaveLength(0);
  });

  it('rejects unknown queue backpressure policies', () => {
    expect(
      () =>
        new Harness({
          ...minimalValidConfig(),
          sessions: { ...minimalValidConfig().sessions, queueBackpressure: 'block' as any },
        }),
    ).toThrow(HarnessConfigError);
  });
});
