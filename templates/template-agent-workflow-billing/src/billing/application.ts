import { validateConfigurationFiles } from './configuration/files.js';
import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';
import { createBillingStudio } from './server/studio.js';
import { BillingError, identifierSchema, parseInput } from './contracts/core.js';
import { initializeMastraBilling } from './mastra-setup.js';
import { createBillingServer, enforceBillingBoundary } from './server/boundary.js';
import { configuredOrganizations, billingDatabaseUrl, readBillingConfiguration } from './configuration/environment.js';
import { materializeResources, validateResourceCatalog } from './resource-catalog.js';
import type { ResourceCatalog, ResourceDefinition } from './resource-catalog.js';
import type { BillingProvider } from './contracts/provider.js';
import { Lifecycle } from './lifecycle.js';

/** Composition options for a billing-protected Mastra application. */
export interface BillingApplicationOptions<D extends readonly ResourceDefinition[]> {
  /** Server configuration and driver-owned credentials; defaults to process.env. */
  readonly environment?: NodeJS.ProcessEnv;
  /** Agent/workflow factories, policies, meters, plans and optional artifact reader. */
  readonly catalog: ResourceCatalog<D>;
  /** Override automatic driver resolution with an implementation of the common contract. */
  readonly billingProvider?: BillingProvider;
  /** Optional Mastra factory for deployments that customize instance construction. */
  readonly createMastra?: (configuration: ConstructorParameters<typeof Mastra>[0]) => Mastra;
}

/** Validate configuration, initialize billing, attach Mastra and start recovery in order. */
export async function createBillingApplication<const D extends readonly ResourceDefinition[]>(
  options: BillingApplicationOptions<D>,
) {
  const environment = options.environment ?? process.env;
  validateConfigurationFiles(environment);
  const catalog = options.catalog;
  const settings = parseInput(
    z.strictObject({
      provider: identifierSchema,
      studio: z.enum(['true', 'false']),
      port: z.coerce.number().int().min(1).max(65535),
    }),
    {
      provider: environment.BILLING_PROVIDER ?? catalog.configuration.provider,
      studio: environment.BILLING_STUDIO_ENABLED ?? 'false',
      port: environment.BILLING_PORT ?? 4111,
    },
  );
  const configuration = validateResourceCatalog(
    catalog,
    readBillingConfiguration(environment),
    options.billingProvider,
  );
  if (configuration.provider !== settings.provider) throw new BillingError('invalid_configuration');
  const lifecycle = new Lifecycle();
  try {
    const organizations = await configuredOrganizations({ ...environment, BILLING_PROVIDER: settings.provider });
    lifecycle.own(() => organizations.close());
    const resources = materializeResources(catalog.definitions, lifecycle);
    const runtime = await initializeMastraBilling({
      organizations,
      configuration,
      agents: resources.agents,
      workflows: resources.workflows,
      databaseUrl: await billingDatabaseUrl(environment),
      billingProvider: options.billingProvider,
      environment,
    });
    lifecycle.own(runtime.close);
    const execution = runtime.billing.http;
    const studio =
      settings.studio === 'true'
        ? createBillingStudio({
            organizations,
            execution,
            commercial: runtime.commercial,
            actions: resources.actions,
          })
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
          ...createBillingServer({
            organizations,
            execution,
            commercial: runtime.commercial,
            studio,
            artifacts: catalog.artifacts,
          }),
        },
      }),
    );
    resources.ready(runtime.billing);
    await runtime.startRecovery().ready;
    return { mastra, organizations, runtime, execution, artifacts: catalog.artifacts, close: () => lifecycle.close() };
  } catch (error) {
    return lifecycle.fail(error);
  }
}
