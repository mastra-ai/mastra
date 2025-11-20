import type { MastraLanguageModel, MastraLanguageModelV2 } from './shared.types';

export function isV2Model(model: MastraLanguageModel): model is MastraLanguageModelV2 {
  return model.specificationVersion === 'v2';
}
