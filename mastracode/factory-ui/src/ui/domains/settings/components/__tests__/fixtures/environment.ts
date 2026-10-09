import type {
  FactoryEnvironmentBuild,
  FactoryEnvironmentBuildTriggers,
  FactoryEnvironmentPayload,
  FactoryEnvironmentRepository,
} from '../../../../workspaces/services/environment';

export const FACTORY_ID = 'fp-1';

export function environmentRepository(
  overrides: Partial<FactoryEnvironmentRepository> & Pick<FactoryEnvironmentRepository, 'projectRepositoryId'>,
): FactoryEnvironmentRepository {
  return {
    connectionId: 'conn-1',
    repositoryId: `repo-${overrides.projectRepositoryId}`,
    slug: `acme/${overrides.projectRepositoryId}`,
    defaultBranch: 'main',
    position: 1,
    inEnvironment: true,
    setupCommand: null,
    teardownCommand: null,
    lastBuildStatus: 'unbuilt',
    lastBuildError: null,
    lastBuiltAt: null,
    ...overrides,
  };
}

export function environmentPayload(overrides: Partial<FactoryEnvironmentPayload> = {}): FactoryEnvironmentPayload {
  return {
    sandbox: {
      provider: 'platform',
      settingsSchema: {
        type: 'object',
        properties: {
          cpuCount: {
            type: 'integer',
            title: 'CPU',
            description: 'vCPUs of the sandbox.',
            minimum: 1,
            maximum: 64,
            default: 2,
          },
          memoryMb: { type: 'integer', title: 'Memory (MB)', minimum: 512, maximum: 65536, default: 1024 },
          idleTimeoutMinutes: {
            type: 'integer',
            title: 'Idle timeout (minutes)',
            minimum: 1,
            maximum: 1440,
            default: 5,
          },
        },
        additionalProperties: false,
      },
      capabilities: { template: true, builds: { available: true, history: false } },
    },
    settings: { cpuCount: 2 },
    sandboxWorkdir: '/workspace',
    workspaceSetupCommand: null,
    activeTemplateId: null,
    activeTemplateHeads: null,
    repositories: [
      environmentRepository({ projectRepositoryId: 'link-web', slug: 'acme/web', position: 1 }),
      environmentRepository({ projectRepositoryId: 'link-api', slug: 'acme/api', position: 2 }),
    ],
    buildTriggers: buildTriggers(),
    build: null,
    ...overrides,
  };
}

export function buildTriggers(
  overrides: Partial<FactoryEnvironmentBuildTriggers> = {},
): FactoryEnvironmentBuildTriggers {
  return {
    schedule: { enabled: false, cron: null, timezone: null, scheduleAvailable: true },
    push: { enabled: false, debounceMinutes: 10 },
    ...overrides,
  };
}

/** An E2B host: the provider keeps a build history with logs. */
export function e2bEnvironment(overrides: Partial<FactoryEnvironmentPayload> = {}): FactoryEnvironmentPayload {
  return environmentPayload({
    sandbox: {
      provider: 'e2b',
      settingsSchema: {
        type: 'object',
        properties: { cpuCount: { type: 'integer', minimum: 1, maximum: 8, default: 2 } },
        additionalProperties: false,
      },
      capabilities: { template: true, builds: { available: true, history: true } },
    },
    settings: {},
    ...overrides,
  });
}

export function buildHistory(): FactoryEnvironmentBuild[] {
  return [
    {
      buildId: 'tpl-1:bld-2',
      status: 'failed',
      templateId: 'tpl-1',
      startedAt: '2026-10-08T10:00:00Z',
      finishedAt: '2026-10-08T10:03:00Z',
      error: 'pnpm install exited with 1',
      logs: ['Step 3/7 RUN pnpm install', 'ERR_PNPM_FETCH 404'],
    },
    {
      buildId: 'tpl-1:bld-1',
      status: 'ready',
      templateId: 'tpl-1',
      startedAt: '2026-10-07T10:00:00Z',
      finishedAt: '2026-10-07T10:04:00Z',
    },
  ];
}

/** A host on the callback form: no settings, no builds. */
export function customEnvironment(overrides: Partial<FactoryEnvironmentPayload> = {}): FactoryEnvironmentPayload {
  return environmentPayload({
    sandbox: {
      provider: 'custom',
      settingsSchema: { type: 'object', properties: {}, additionalProperties: false },
      capabilities: { template: false, builds: { available: false, history: false } },
    },
    settings: {},
    buildTriggers: undefined,
    build: undefined,
    ...overrides,
  });
}
