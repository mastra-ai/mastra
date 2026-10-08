import type {
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
    sandboxProvider: 'platform',
    sandboxWorkdir: '/workspace',
    sandboxCpuCount: 2,
    sandboxMemoryMb: 4096,
    sandboxIdleTimeoutMinutes: 30,
    workspaceSetupCommand: null,
    activeTemplateId: null,
    activeTemplateHeads: null,
    repositories: [
      environmentRepository({ projectRepositoryId: 'link-web', slug: 'acme/web', position: 1 }),
      environmentRepository({ projectRepositoryId: 'link-api', slug: 'acme/api', position: 2 }),
    ],
    buildTriggers: {
      schedule: { enabled: true, hours: 24 },
      onPush: { enabled: true, debounceMinutes: 10, maxPerHour: 4 },
    },
    build: {
      status: null,
      error: null,
      lastBuiltAt: null,
      activeTemplateId: null,
      requestedAt: null,
      pushSignal: 'polling',
    },
    ...overrides,
  };
}
