import { PROVIDER_REGISTRY } from '../provider-registry.js';
import { MastraGateway } from './mastra.js';
import { ModelsDevGateway } from './models-dev.js';
import { NetlifyGateway } from './netlify.js';

function getStaticProvidersByGateway(name: string) {
  return Object.fromEntries(Object.entries(PROVIDER_REGISTRY).filter(([_provider, config]) => config.gateway === name));
}

export const defaultGateways = [
  new NetlifyGateway(),
  new MastraGateway(),
  new ModelsDevGateway(getStaticProvidersByGateway(`models.dev`)),
];

/**
 * @deprecated Use {@link defaultGateways} instead. This export will be removed in a future version.
 */
export const gateways = defaultGateways;
