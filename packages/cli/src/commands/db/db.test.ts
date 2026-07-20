import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as EnvPlatformApi from '../env/platform-api.js';
import type { Environment, Project } from '../env/platform-api.js';
import { defaultDatabaseName, formatScope, resolveDefaultEnvironment } from './db.js';

const selectMock = vi.fn();
const cancelMock = vi.fn();
const isCancelMock = vi.fn().mockReturnValue(false);

vi.mock('@clack/prompts', () => ({
  select: (args: unknown) => selectMock(args),
  cancel: (args: unknown) => cancelMock(args),
  isCancel: (v: unknown) => isCancelMock(v),
  spinner: () => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}));

const fetchEnvironmentsMock = vi.fn();
vi.mock('../env/platform-api.js', async () => {
  const actual = await vi.importActual<typeof EnvPlatformApi>('../env/platform-api.js');
  return {
    ...actual,
    fetchEnvironments: (...args: unknown[]) => fetchEnvironmentsMock(...args),
  };
});

const environment = {
  id: 'env-1',
  projectId: 'proj-1',
  name: 'Staging',
  slug: 'my-app-staging',
  type: 'staging',
  region: 'eu',
  branch: null,
  instanceUrl: null,
  customServerUrl: null,
  observabilityProjectId: null,
  envVars: null,
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
} as Environment;

function makeEnv(overrides: Partial<Environment> & Pick<Environment, 'id' | 'slug' | 'type'>): Environment {
  return {
    ...environment,
    name: overrides.slug,
    ...overrides,
  } as Environment;
}

const project = {
  id: 'proj-1',
  name: 'My App',
  slug: 'my-app',
  organizationId: 'org-1',
} as Project;

describe('formatScope', () => {
  it('labels project-scoped databases as shared by all environments', () => {
    expect(formatScope({ environmentId: null }, [environment])).toBe('project (all environments)');
  });

  it('resolves env-scoped databases to the environment slug', () => {
    expect(formatScope({ environmentId: 'env-1' }, [environment])).toBe('environment: my-app-staging');
  });

  it('falls back to the raw environment id when the environment is gone', () => {
    expect(formatScope({ environmentId: 'env-gone' }, [environment])).toBe('environment: env-gone');
  });
});

describe('defaultDatabaseName', () => {
  it('derives a name from the project slug', () => {
    expect(defaultDatabaseName({ name: 'My App', slug: 'my-app' })).toBe('my-app-db');
  });

  it('falls back to the project name and sanitizes it for DNS-safe providers', () => {
    expect(defaultDatabaseName({ name: 'My_Fancy App!', slug: null })).toBe('my-fancy-app-db');
  });

  it('never returns leading/trailing hyphens or an empty base', () => {
    expect(defaultDatabaseName({ name: '---', slug: null })).toBe('mastra-db');
  });

  it('does not suffix production-type environments (keeps the canonical name)', () => {
    expect(
      defaultDatabaseName(
        { name: 'My App', slug: 'my-app' },
        { name: 'production', slug: 'my-app', type: 'production' },
      ),
    ).toBe('my-app-db');
  });

  it('recognises production by env type even when the env is renamed (e.g. `main`)', () => {
    // Users are free to rename their production env; we must not suffix
    // it and orphan the canonical DB.
    expect(
      defaultDatabaseName({ name: 'My App', slug: 'my-app' }, { name: 'main', slug: 'main', type: 'production' }),
    ).toBe('my-app-db');
  });

  it('suffixes a non-production env even if it happens to be named `production`', () => {
    // The name is not the discriminator — the type is.
    expect(
      defaultDatabaseName(
        { name: 'My App', slug: 'my-app' },
        { name: 'production', slug: 'production', type: 'staging' },
      ),
    ).toBe('my-app-production-db');
  });

  it('suffixes non-production environments so multi-env attaches do not collide', () => {
    expect(
      defaultDatabaseName({ name: 'My App', slug: 'my-app' }, { name: 'eu', slug: 'my-app--eu', type: 'preview' }),
    ).toBe('my-app-eu-db');
    expect(
      defaultDatabaseName(
        { name: 'My App', slug: 'my-app' },
        { name: 'staging', slug: 'my-app--staging', type: 'staging' },
      ),
    ).toBe('my-app-staging-db');
  });

  it('sanitizes env names into DNS-safe segments', () => {
    expect(
      defaultDatabaseName({ name: 'My App', slug: 'my-app' }, { name: 'EU West', slug: 'eu', type: 'preview' }),
    ).toBe('my-app-eu-west-db');
  });

  it('truncates the project segment (not the env) so long-slug projects still get distinct names per env', () => {
    // 60-char project slug + `-eu-db` / `-us-db` would collide if we
    // truncated the tail. Both must produce distinct names.
    const longSlug = 'a'.repeat(60);
    const euName = defaultDatabaseName({ name: 'App', slug: longSlug }, { name: 'eu', slug: 'eu', type: 'preview' });
    const usName = defaultDatabaseName({ name: 'App', slug: longSlug }, { name: 'us', slug: 'us', type: 'preview' });
    expect(euName).not.toBe(usName);
    expect(euName.length).toBeLessThanOrEqual(64);
    expect(usName.length).toBeLessThanOrEqual(64);
    expect(euName.endsWith('-eu-db')).toBe(true);
    expect(usName.endsWith('-us-db')).toBe(true);
  });

  it('respects the 64-char cap even with long env discriminators', () => {
    const longSlug = 'p'.repeat(50);
    const longEnv = 'e'.repeat(30);
    const name = defaultDatabaseName(
      { name: 'App', slug: longSlug },
      { name: longEnv, slug: longEnv, type: 'preview' },
    );
    expect(name.length).toBeLessThanOrEqual(64);
    expect(name.endsWith('-db')).toBe(true);
    // Env discriminator must survive in some form even when the budget
    // is fully consumed.
    expect(name).toContain('-e');
  });

  it('drops a hyphen at the truncation boundary so the joined name stays DNS-clean', () => {
    // A slug whose char at the cutoff is `-` would leave `foo--eu-db`
    // if we naively sliced. The result must have no double hyphens.
    const slug = 'x-'.repeat(40).replace(/-$/, ''); // long alternating x-x-x-...
    const name = defaultDatabaseName({ name: 'X', slug }, { name: 'eu', slug: 'eu', type: 'preview' });
    expect(name).not.toMatch(/--/);
    expect(name.length).toBeLessThanOrEqual(64);
  });
});

describe('resolveDefaultEnvironment', () => {
  const originalStdinTTY = process.stdin.isTTY;
  const originalStdoutTTY = process.stdout.isTTY;
  const originalCI = process.env.CI;

  beforeEach(() => {
    fetchEnvironmentsMock.mockReset();
    selectMock.mockReset();
    isCancelMock.mockReset().mockReturnValue(false);
    // Default to interactive TTY; individual tests override as needed.
    (process.stdin as unknown as { isTTY: boolean }).isTTY = true;
    (process.stdout as unknown as { isTTY: boolean }).isTTY = true;
    delete process.env.CI;
  });

  afterEach(() => {
    (process.stdin as unknown as { isTTY: boolean | undefined }).isTTY = originalStdinTTY;
    (process.stdout as unknown as { isTTY: boolean | undefined }).isTTY = originalStdoutTTY;
    if (originalCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = originalCI;
    }
  });

  it('errors when the project has no environments', async () => {
    fetchEnvironmentsMock.mockResolvedValue([]);
    await expect(resolveDefaultEnvironment('t', 'org-1', project)).rejects.toThrow(/has no environments/);
  });

  it('auto-selects the sole environment without prompting', async () => {
    const only = makeEnv({ id: 'env-prod', slug: 'my-app-production', type: 'production' });
    fetchEnvironmentsMock.mockResolvedValue([only]);

    const result = await resolveDefaultEnvironment('t', 'org-1', project);

    expect(result).toBe(only);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('errors in non-interactive mode when multiple environments exist', async () => {
    (process.stdin as unknown as { isTTY: boolean }).isTTY = false;
    fetchEnvironmentsMock.mockResolvedValue([
      makeEnv({ id: 'env-prod', slug: 'prod', type: 'production' }),
      makeEnv({ id: 'env-stg', slug: 'stg', type: 'staging' }),
    ]);

    await expect(resolveDefaultEnvironment('t', 'org-1', project)).rejects.toThrow(/multiple environments/);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('errors when --json is set and multiple environments exist, even on a TTY', async () => {
    fetchEnvironmentsMock.mockResolvedValue([
      makeEnv({ id: 'env-prod', slug: 'prod', type: 'production' }),
      makeEnv({ id: 'env-stg', slug: 'stg', type: 'staging' }),
    ]);

    await expect(resolveDefaultEnvironment('t', 'org-1', project, { json: true })).rejects.toThrow(
      /multiple environments/,
    );
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('prompts with production pre-selected when multiple environments exist and TTY is interactive', async () => {
    const prod = makeEnv({ id: 'env-prod', slug: 'prod', type: 'production' });
    const staging = makeEnv({ id: 'env-stg', slug: 'stg', type: 'staging' });
    fetchEnvironmentsMock.mockResolvedValue([staging, prod]);
    selectMock.mockResolvedValue('env-stg');

    const result = await resolveDefaultEnvironment('t', 'org-1', project);

    expect(selectMock).toHaveBeenCalledTimes(1);
    const call = selectMock.mock.calls[0]![0] as { initialValue: string; options: { value: string }[] };
    expect(call.initialValue).toBe('env-prod');
    expect(call.options.map(o => o.value)).toEqual(['env-stg', 'env-prod']);
    expect(result).toBe(staging);
  });

  it('falls back to the first environment when no production environment exists', async () => {
    const staging = makeEnv({ id: 'env-stg', slug: 'stg', type: 'staging' });
    const preview = makeEnv({ id: 'env-prev', slug: 'prev', type: 'preview' });
    fetchEnvironmentsMock.mockResolvedValue([staging, preview]);
    selectMock.mockResolvedValue('env-prev');

    await resolveDefaultEnvironment('t', 'org-1', project);

    const call = selectMock.mock.calls[0]![0] as { initialValue: string };
    expect(call.initialValue).toBe('env-stg');
  });
});
