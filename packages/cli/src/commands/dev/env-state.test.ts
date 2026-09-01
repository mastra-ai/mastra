import { describe, expect, it } from 'vitest';
import { createEnvironmentState } from './env-state';

describe('createEnvironmentState', () => {
  it('preserves inherited values while applying loaded dotenv values to the CLI and server', () => {
    const environment = { FROM_SHELL: 'shell', PATH: 'path' };
    const state = createEnvironmentState(environment);
    const loadedEnv = new Map([
      ['FROM_SHELL', 'dotenv'],
      ['FROM_ENV', 'dotenv'],
    ]);

    state.sync(loadedEnv);

    expect(environment).toEqual({ FROM_SHELL: 'shell', PATH: 'path', FROM_ENV: 'dotenv' });
    expect(state.getChildEnvironment(loadedEnv)).toMatchObject({
      FROM_SHELL: 'shell',
      PATH: 'path',
      FROM_ENV: 'dotenv',
    });
  });

  it('refreshes dotenv-owned keys without deleting inherited values', () => {
    const environment = { FROM_SHELL: 'shell' };
    const state = createEnvironmentState(environment);
    state.sync(
      new Map([
        ['FROM_ENV', 'first'],
        ['REMOVED', 'value'],
      ]),
    );
    state.sync(new Map([['FROM_ENV', 'second']]));

    expect(environment).toEqual({ FROM_SHELL: 'shell', FROM_ENV: 'second' });
  });

  it('allows CLI-generated values to replace inherited values intentionally', () => {
    const environment = { MASTRA_REQUEST_CONTEXT_PRESETS: 'stale' };
    const state = createEnvironmentState(environment);
    state.allowLoadedOverride('MASTRA_REQUEST_CONTEXT_PRESETS');
    state.sync(new Map([['MASTRA_REQUEST_CONTEXT_PRESETS', 'fresh']]));

    expect(environment).toEqual({ MASTRA_REQUEST_CONTEXT_PRESETS: 'fresh' });
  });
});
