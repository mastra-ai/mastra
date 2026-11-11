import { imageDefinitions } from './images/resources.js';
import { ImageService } from './images/service.js';
import { imageConfiguration } from './images/configuration.js';
import { validateProviderConfiguration } from './billing/setup.js';
import { BillingError } from './billing/contracts.js';
import type { ResourceDefinition } from './billing/resource-catalog.js';
import type { ResourceCatalog } from './billing/resource-catalog.js';

export function applicationCatalog(environment: NodeJS.ProcessEnv = process.env, workspaceIds?: readonly string[]) {
  const { resources: configuredResources, ...configuration } = environment.BILLING_CONFIGURATION
    ? validateProviderConfiguration(JSON.parse(environment.BILLING_CONFIGURATION))
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
  const artifacts = new ImageService(environment);
  const [agent, workflow] = imageDefinitions(environment, artifacts);
  return {
    resources: [configure(agent), configure(workflow)],
    artifacts,
    configuration: { ...configuration, provider: environment.BILLING_PROVIDER ?? 'local' },
  } as const satisfies ResourceCatalog;
}
