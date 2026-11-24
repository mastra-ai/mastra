import type { ModelPack } from '@mastra/factory/model-packs';
import { formatModelName } from '@mastra/playground-ui/utils/model';

import { THINKING_LEVEL_LABELS } from './thinkingLevels';

export function modelPackChain(pack: ModelPack): string {
  return pack.models
    .map(model => `${formatModelName(model.modelId)} · ${THINKING_LEVEL_LABELS[model.thinkingLevel]}`)
    .join(' → ');
}
