import type { DesktopSettings, ProbeModelsResult } from '../shared/types';
import { DEFAULT_MODEL_API_KEY, DEFAULT_MODEL_ID, DEFAULT_MODEL_URL } from './defaults';

export const LM_STUDIO_PRESET = {
  id: 'lmstudio',
  name: 'LM Studio',
  modelUrl: DEFAULT_MODEL_URL,
  modelId: DEFAULT_MODEL_ID,
  modelApiKey: DEFAULT_MODEL_API_KEY,
} as const;

export function selectLmStudioModelId(result: ProbeModelsResult, fallback = LM_STUDIO_PRESET.modelId) {
  return result.ok && result.models.length > 0 ? result.models[0]! : fallback;
}

export function buildLmStudioPresetSettings(
  currentSettings: DesktopSettings,
  detectedModelId = LM_STUDIO_PRESET.modelId,
): DesktopSettings {
  return {
    ...currentSettings,
    serverMode: 'managed',
    modelUrl: LM_STUDIO_PRESET.modelUrl,
    modelId: detectedModelId,
    modelApiKey: LM_STUDIO_PRESET.modelApiKey,
  };
}
