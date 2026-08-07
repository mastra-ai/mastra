import type { ModelPackInfo, ModelPacksResponse } from '../../../api/types';

export const builtinPack: ModelPackInfo = {
  id: 'builtin:balanced',
  name: 'Balanced',
  description: 'A balanced pack',
  models: { build: 'p/build', plan: 'p/plan', fast: 'p/fast' },
  custom: false,
  active: false,
};

export const customPack: ModelPackInfo = {
  id: 'custom:Mine',
  name: 'Mine',
  description: '',
  models: { build: 'p/build', plan: 'p/plan', fast: 'p/fast' },
  custom: true,
  active: false,
};

export function packsResponse(activePackId: string | null = null): ModelPacksResponse {
  return {
    packs: [
      { ...builtinPack, active: builtinPack.id === activePackId },
      { ...customPack, active: customPack.id === activePackId },
    ],
    activePackId,
  };
}
