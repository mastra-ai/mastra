import type { OMConfigInfo, OMResponse } from '../../../api/types';

export const omConfig: OMConfigInfo = {
  observer: {
    selection: { mode: 'model', modelId: 'p/observer' },
    effectiveModelId: 'p/observer',
    providerStatus: 'available',
  },
  reflector: {
    selection: { mode: 'model', modelId: 'p/reflector' },
    effectiveModelId: 'p/reflector',
    providerStatus: 'available',
  },
  observerModelId: 'p/observer',
  reflectorModelId: 'p/reflector',
  observationThreshold: 30_000,
  reflectionThreshold: 40_000,
  observeAttachments: 'auto',
};

export function omResponse(overrides: Partial<OMConfigInfo> = {}): OMResponse {
  return { config: { ...omConfig, ...overrides } };
}
