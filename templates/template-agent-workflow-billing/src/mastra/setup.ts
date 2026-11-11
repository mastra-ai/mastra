import type { AutumnProviderOptions } from '../billing/providers/autumn.js';
import { createBillingStudio } from '../server/studio.js';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';
import { BillingError, parseInput } from '../billing/contracts.js';
import { initializeMastraBilling } from '../billing/mastra-setup.js';
import { billingOnlyServer, enforceBillingBoundary } from '../server/security.js';
import { readLocalProfiles } from '../local/profiles.js';
import { configuredOrganizations, billingDatabaseUrl } from './environment.js';
import { applicationCatalog } from '../resources.js';
import { materializeResources, validateResourceCatalog } from '../billing/resource-catalog.js';
import type { ResourceCatalog, ResourceDefinition } from '../billing/resource-catalog.js';
import { Lifecycle } from '../billing/lifecycle.js';
export { configuredOrganizations } from './environment.js';

export interface BillingApplicationOptions<D extends readonly ResourceDefinition[]> {
  readonly autumn?: AutumnProviderOptions;
  readonly catalog?: ResourceCatalog<D>;
  readonly createMastra?: (configuration: ConstructorParameters<typeof Mastra>[0]) => Mastra;
}
type DefaultDefinitions = ReturnType<typeof applicationCatalog>['resources'];
export function createBillingApplication<const D extends readonly ResourceDefinition[]>(
  environment: NodeJS.ProcessEnv,
  options: BillingApplicationOptions<D> & { catalog: ResourceCatalog<D> },
): ReturnType<typeof buildApplication<D>>;
export function createBillingApplication(
  environment?: NodeJS.ProcessEnv,
  options?: { autumn?: AutumnProviderOptions },
): ReturnType<typeof buildApplication<DefaultDefinitions>>;
export async function createBillingApplication(
  environment: NodeJS.ProcessEnv = process.env,
  options: BillingApplicationOptions<readonly ResourceDefinition[]> = {},
) {
  return buildApplication(environment, options.catalog ?? applicationCatalog(environment), options);
}
async function buildApplication<const D extends readonly ResourceDefinition[]>(
  environment: NodeJS.ProcessEnv,
  catalog: ResourceCatalog<D>,
  options: BillingApplicationOptions<D>,
) {
  const settings = parseInput(
    z.strictObject({
      provider: z.enum(['local', 'autumn']),
      studio: z.enum(['true', 'false']),
      port: z.coerce.number().int().min(1).max(65535),
    }),
    {
      provider: environment.BILLING_PROVIDER ?? 'local',
      studio: environment.BILLING_STUDIO_ENABLED ?? 'false',
      port: environment.BILLING_PORT ?? 4111,
    },
  );
  const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
  const override: unknown = environment.BILLING_CONFIGURATION
    ? JSON.parse(environment.BILLING_CONFIGURATION)
    : undefined;
  // Validate before identity/storage, factories, recovery, serving or provider calls.
  let configuration = validateResourceCatalog(catalog, override);
  if (configuration.provider !== settings.provider) throw new BillingError('invalid_configuration');
  const lifecycle = new Lifecycle();
  try {
    const organizations = await configuredOrganizations(environment);
    lifecycle.own(() => organizations.close());
    const profiles =
      !options.catalog && settings.provider === 'local' && organizations.identity.kind === 'local'
        ? await readLocalProfiles(root)
        : null;
    if (profiles && (!profiles.ready || profiles.databaseUrl !== (await billingDatabaseUrl(environment))))
      throw new BillingError('state_unavailable');
    if (!options.catalog && !override && profiles)
      configuration = validateResourceCatalog(
        applicationCatalog(
          environment,
          Object.values(profiles.profiles).map(profile => profile!.workspaceId),
        ),
      );
    const resources = materializeResources(catalog.resources, lifecycle);
    const runtime = await initializeMastraBilling({
      organizations,
      configuration,
      agents: resources.agents,
      workflows: resources.workflows,
      databaseUrl: await billingDatabaseUrl(environment),
      autumn:
        settings.provider === 'autumn'
          ? (options.autumn ?? {
              secretKey: environment.AUTUMN_SECRET_KEY ?? '',
              bindings: JSON.parse(environment.AUTUMN_BINDINGS ?? 'null'),
            })
          : undefined,
    });
    lifecycle.own(runtime.close);
    const execution = runtime.billing.http;
    const studio =
      settings.studio === 'true'
        ? createBillingStudio(organizations, execution, runtime.commercial, resources.actions)
        : undefined;
    const mastra = enforceBillingBoundary(
      (options.createMastra ?? (configuration => new Mastra(configuration)))({
        logger: false,
        tools: studio?.tools,
        agents: resources.nativeAgents,
        workflows: resources.nativeWorkflows,
        storage: runtime.storage,
        server: {
          host: '127.0.0.1',
          port: settings.port,
          ...billingOnlyServer(organizations, execution, runtime.commercial, studio),
        },
      }),
    );
    resources.ready(runtime.billing);
    await runtime.startRecovery().ready;
    return { mastra, organizations, runtime, execution, close: () => lifecycle.close() };
  } catch (error) {
    return lifecycle.fail(error);
  }
}
export async function configuredMastra(environment: NodeJS.ProcessEnv = process.env) {
  const application = await createBillingApplication(environment);
  const close = () => application.close();
  process.once('beforeExit', () => {
    void close();
  });
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => {
      void close().finally(() => process.exit(0));
    });
  return application.mastra;
}
