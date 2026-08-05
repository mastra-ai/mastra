import type { OMConfigInfo, OMResponse } from '../../../api/types';

export const omConfig: OMConfigInfo = {
  observerModelId: 'p/observer',
  reflectorModelId: 'p/reflector',
  observationThreshold: 30_000,
  reflectionThreshold: 40_000,
  observeAttachments: 'auto',
};

export function omResponse(overrides: Partial<OMConfigInfo> = {}): OMResponse {
  return { config: { ...omConfig, ...overrides } };
}
