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
    sandbox: {
      provider: 'platform',
      settingsSchema: {
        type: 'object',
        properties: {
          cpuCount: { type: 'integer', title: 'CPU', minimum: 1, maximum: 64 },
          memoryMb: { type: 'integer', title: 'Memory (MB)', minimum: 512, maximum: 65536 },
        },
        additionalProperties: false,
      },
      capabilities: { template: true, builds: { available: true, history: false } },
    },
    settings: { cpuCount: 2, memoryMb: 4096 },
    sandboxWorkdir: '/workspace',
    workspaceSetupCommand: null,
    activeTemplateId: null,
    activeTemplateHeads: null,
    repositories: [
      environmentRepository({ projectRepositoryId: 'link-web', slug: 'acme/web', position: 1 }),
      environmentRepository({ projectRepositoryId: 'link-api', slug: 'acme/api', position: 2 }),
    ],
    ...overrides,
  };
}
