import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ObservationalMemoryModule = typeof import('../observational-memory');

async function loadFreshModule(): Promise<ObservationalMemoryModule> {
  vi.resetModules();
  return import('../observational-memory');
}

function create(mod: ObservationalMemoryModule, scope?: 'thread' | 'resource') {
  return new mod.ObservationalMemory({
    storage: new InMemoryMemory({ db: new InMemoryDB() }),
    scope,
    model: 'openai/gpt-5-mini',
  });
}

describe('ObservationalMemory resource scope deprecation', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const deprecationCalls = () =>
    warn.mock.calls.filter(args => String(args[0]).includes("`scope: 'resource'` is deprecated"));

  it('warns exactly once per process when resource scope is used', async () => {
    const mod = await loadFreshModule();

    create(mod, 'resource');
    create(mod, 'resource');
    create(mod, 'resource');

    expect(deprecationCalls()).toHaveLength(1);
  });

  it('still warns for a valid resource-scoped instance after an invalid one throws', async () => {
    const mod = await loadFreshModule();

    expect(
      () =>
        new mod.ObservationalMemory({
          storage: new InMemoryMemory({ db: new InMemoryDB() }),
          scope: 'resource',
          model: 'openai/gpt-5-mini',
          observation: { bufferTokens: 1000 },
        }),
    ).toThrow(/Async buffering is not yet supported/);
    expect(deprecationCalls()).toHaveLength(0);

    create(mod, 'resource');

    expect(deprecationCalls()).toHaveLength(1);
  });

  it('does not warn for thread scope or the default scope', async () => {
    const mod = await loadFreshModule();

    create(mod);
    create(mod, 'thread');

    expect(deprecationCalls()).toHaveLength(0);
  });
});
