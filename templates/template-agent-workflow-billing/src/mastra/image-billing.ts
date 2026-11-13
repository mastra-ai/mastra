import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { ExecutionArtifacts } from '../billing/storage/artifacts.js';
import { billingDatabaseUrl, readBillingConfiguration } from '../billing/environment.js';
import { readLocalProfiles } from '../billing/local-profiles.js';
import { createBillingApplication } from '../billing/application.js';
import type { BillingProvider } from '../billing/providers/contracts.js';
import type { BillingConfiguration } from '../billing/policy-configuration.js';
import { imageDefinitions } from './image-definitions.js';
import { ImageService } from '../images/service.js';
import { imageConfiguration } from './image-plans.js';
import { validateProviderConfiguration } from '../billing/setup.js';
import { BillingError } from '../billing/contracts.js';
import type { ResourceDefinition } from '../billing/resource-catalog.js';
import { validateResourceCatalog } from '../billing/resource-catalog.js';
import type { ResourceCatalog } from '../billing/resource-catalog.js';

export function imageBillingCatalog(environment: NodeJS.ProcessEnv = process.env, workspaceIds?: readonly string[]) {
  const { resourcePolicies: configuredResources, ...configuration } = environment.BILLING_CONFIGURATION
    ? validateProviderConfiguration(readBillingConfiguration(environment))
    : imageConfiguration(workspaceIds);
  const configure = <R extends ResourceDefinition>(definition: R) => {
    const configured = configuredResources.find(resource => resource.id === definition.id);
    if (!configured || configured.kind !== definition.kind) throw new BillingError('invalid_configuration');
    return {
      ...definition,
      operations: configured.operations,
      measurements: configured.measurements,
      policy: configured.policy,
    };
  };
  const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
  const databaseUrl = environment.BILLING_DATABASE_URL ?? pathToFileURL(resolve(root, 'data/billing.db')).href;
  const artifacts = new ImageService(
    environment,
    new ExecutionArtifacts(databaseUrl),
    resolve(dirname(fileURLToPath(databaseUrl)), 'private-images'),
  );
  const [agent, workflow] = imageDefinitions(environment, artifacts);
  return {
    definitions: [configure(agent), configure(workflow)],
    artifacts,
    configuration: { ...configuration, provider: environment.BILLING_PROVIDER ?? 'local' },
  } as const satisfies ResourceCatalog;
}

/** Assemble the image example using local demo profiles only when local identity is selected. */
export async function createImageApplication(
  options: {
    /** Driver selection, identity settings and image credentials. */
    environment?: NodeJS.ProcessEnv;
    /** Logical billing keys and versioned plans; full BILLING_CONFIGURATION takes precedence. */
    billing?: Pick<BillingConfiguration, 'billingKeys' | 'catalog'>;
    /** Optional billing driver for embedded integrations. */
    billingProvider?: BillingProvider;
  } = {},
) {
  const environment = options.environment ?? process.env;
  let catalog = imageBillingCatalog(environment);
  // Reject invalid policies before reading private local profile state.
  validateResourceCatalog(catalog);
  if ((environment.BILLING_PROVIDER ?? 'local') === 'local' && !environment.BILLING_JWT_CONFIGURATION) {
    const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
    const profiles = await readLocalProfiles(root);
    if (!profiles?.ready || profiles.databaseUrl !== (await billingDatabaseUrl(environment)))
      throw new BillingError('state_unavailable');
    if (!environment.BILLING_CONFIGURATION)
      catalog = {
        ...catalog,
        configuration: {
          ...catalog.configuration,
          localAccounts: imageConfiguration(Object.values(profiles.profiles).map(profile => profile!.workspaceId))
            .localAccounts,
        },
      };
  }
  if (options.billing && !environment.BILLING_CONFIGURATION)
    catalog = { ...catalog, configuration: { ...catalog.configuration, ...options.billing } };
  return createBillingApplication({ environment, catalog, billingProvider: options.billingProvider });
}
