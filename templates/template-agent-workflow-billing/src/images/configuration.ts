import { billingConfigurationSchema } from '../billing/configuration.js';
import { imageDefinitions } from './resources.js';
import { ImageService } from './service.js';
export function imageConfiguration(workspaceIds?: string | readonly string[]) {
  return billingConfigurationSchema.parse({
    provider: 'local',
    resources: imageDefinitions({}, new ImageService()).map(({ id, kind, operations, measurements, policy }) => ({
      id,
      kind,
      operations,
      measurements,
      policy,
    })),
    mappings: { meters: [{ key: 'image-credits', unit: 'credits', funding: ['prepaid'] }] },
    localAccounts: (typeof workspaceIds === 'string' ? [workspaceIds] : (workspaceIds ?? [])).map(workspaceId => ({
      workspaceId,
      meters: [{ key: 'image-credits', funding: 'prepaid', balance: 30 }],
    })),
  });
}
