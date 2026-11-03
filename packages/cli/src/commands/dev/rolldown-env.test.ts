import { beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_KEYS = ['ROLLDOWN_WORKER_THREADS', 'RAYON_NUM_THREADS', 'MIMALLOC_ARENA_PURGE_MULT'];

// The applied defaults are module state, so every test gets a fresh module.
async function load() {
  vi.resetModules();
  return import('./rolldown-env');
}

describe('rolldown env defaults', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.each([
    [['dev'], true],
    [['dev', '--dir', 'src/mastra', '--https'], true],
    [['factory', 'dev', '-d', 'src'], true],
    [['build'], false],
    [['start'], false],
    [['worker', 'dev'], false],
    [['help', 'dev'], false],
    [['--version'], false],
    [[], false],
  ])('treats `mastra %j` as a dev server command: %s', async (args, expected) => {
    const { isDevServerCommand } = await load();
    expect(isDevServerCommand(args)).toBe(expected);
  });

  it('sets the thread and allocator defaults for mastra dev only', async () => {
    const { applyDevRolldownEnvDefaults } = await load();

    const buildEnv: NodeJS.ProcessEnv = {};
    applyDevRolldownEnvDefaults(['build'], buildEnv);
    expect(buildEnv).toEqual({});

    const devEnv: NodeJS.ProcessEnv = {};
    applyDevRolldownEnvDefaults(['dev'], devEnv);
    expect(devEnv).toEqual({ ROLLDOWN_WORKER_THREADS: '4', RAYON_NUM_THREADS: '4', MIMALLOC_ARENA_PURGE_MULT: '0' });
  });

  it('keeps values the user set, including empty ones', async () => {
    const { applyDevRolldownEnvDefaults } = await load();
    const env: NodeJS.ProcessEnv = { ROLLDOWN_WORKER_THREADS: '12', MIMALLOC_ARENA_PURGE_MULT: '' };

    applyDevRolldownEnvDefaults(['dev'], env);

    expect(env).toEqual({ ROLLDOWN_WORKER_THREADS: '12', RAYON_NUM_THREADS: '4', MIMALLOC_ARENA_PURGE_MULT: '' });
  });

  it('gives a process running user code only the variables the user set', async () => {
    const { applyDevRolldownEnvDefaults, withoutDevRolldownEnvDefaults } = await load();
    const env: NodeJS.ProcessEnv = { RAYON_NUM_THREADS: '8', PATH: '/bin' };
    applyDevRolldownEnvDefaults(['dev'], env);

    // A dotenv value for a variable the CLI defaulted reaches the server, as it would without the default.
    const childEnv = withoutDevRolldownEnvDefaults(env, new Map([['MIMALLOC_ARENA_PURGE_MULT', '1']]));

    expect(childEnv).toEqual({ RAYON_NUM_THREADS: '8', PATH: '/bin', MIMALLOC_ARENA_PURGE_MULT: '1' });
    for (const key of DEFAULT_KEYS) {
      expect(env[key]).toBeDefined();
    }
  });
});
