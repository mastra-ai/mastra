import { z } from 'zod';
import { weatherDefinitions } from './weather/resources.js';
import { weatherConfiguration } from './weather/configuration.js';
import { validateProviderConfiguration } from './billing/setup.js';
import { BillingError } from './billing/contracts.js';
import type { ResourceDefinition } from './billing/resource-catalog.js';
import { parseInput } from './billing/contracts.js';
import type { ResourceCatalog } from './billing/resource-catalog.js';

export function applicationCatalog(environment: NodeJS.ProcessEnv = process.env, workspaceIds?: readonly string[]) {
  const policy = parseInput(z.enum(['task', 'tokens']), environment.WEATHER_WORKFLOW_POLICY ?? 'task');
  const { resources: configuredResources, ...configuration } = environment.BILLING_CONFIGURATION
    ? validateProviderConfiguration(JSON.parse(environment.BILLING_CONFIGURATION))
    : weatherConfiguration(workspaceIds, policy);
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
  const [agent, workflow] = weatherDefinitions(environment, policy);
  return {
    resources: [configure(agent), configure(workflow)],
    configuration: { ...configuration, provider: environment.BILLING_PROVIDER ?? 'local' },
  } as const satisfies ResourceCatalog;
}
