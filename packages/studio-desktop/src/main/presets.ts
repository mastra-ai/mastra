import { LOCAL_MODEL_PRESETS } from '../shared/model-presets';
import type { LocalModelPreset } from '../shared/model-presets';
import type { DesktopSettings, ProbeModelsResult } from '../shared/types';

export type ModelPreset = LocalModelPreset;

export const LM_STUDIO_PRESET = LOCAL_MODEL_PRESETS.lmstudio;
export const OLLAMA_PRESET = LOCAL_MODEL_PRESETS.ollama;

export function selectDetectedModelId(result: ProbeModelsResult, fallback: string) {
  return result.ok && result.models.length > 0 ? result.models[0]! : fallback;
}

export function selectLmStudioModelId(result: ProbeModelsResult, fallback = LM_STUDIO_PRESET.modelId) {
  return selectDetectedModelId(result, fallback);
}

export function buildModelPresetSettings(currentSettings: DesktopSettings, preset: ModelPreset): DesktopSettings {
  return {
    ...currentSettings,
    serverMode: 'managed',
    modelUrl: preset.modelUrl,
    modelId: preset.modelId,
    modelApiKey: preset.modelApiKey,
  };
}

export function buildLmStudioPresetSettings(
  currentSettings: DesktopSettings,
  detectedModelId = LM_STUDIO_PRESET.modelId,
): DesktopSettings {
  return buildModelPresetSettings(currentSettings, {
    ...LM_STUDIO_PRESET,
    modelId: detectedModelId,
  });
}
