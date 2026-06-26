import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import {
  buildLmStudioPresetSettings,
  buildModelPresetSettings,
  LM_STUDIO_PRESET,
  OLLAMA_PRESET,
  selectLmStudioModelId,
} from './presets';

describe('LM Studio preset', () => {
  it('uses the first detected model when LM Studio is reachable', () => {
    expect(
      selectLmStudioModelId({
        ok: true,
        modelUrl: LM_STUDIO_PRESET.modelUrl,
        models: ['loaded-model', 'other-model'],
      }),
    ).toBe('loaded-model');
  });

  it('falls back to the default model when probing fails', () => {
    expect(
      selectLmStudioModelId({
        ok: false,
        modelUrl: LM_STUDIO_PRESET.modelUrl,
        models: [],
        error: 'offline',
      }),
    ).toBe(LM_STUDIO_PRESET.modelId);
  });

  it('forces managed mode and the LM Studio OpenAI-compatible URL', () => {
    expect(
      buildLmStudioPresetSettings(
        {
          ...DEFAULT_SETTINGS,
          serverMode: 'external',
          externalServerUrl: 'http://127.0.0.1:5222',
          modelUrl: 'http://localhost:9999/v1',
          modelId: 'other-provider/other-model',
          modelApiKey: 'secret',
        },
        'detected-model',
      ),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      serverMode: 'managed',
      externalServerUrl: 'http://127.0.0.1:5222',
      modelUrl: LM_STUDIO_PRESET.modelUrl,
      modelId: 'detected-model',
      modelApiKey: LM_STUDIO_PRESET.modelApiKey,
    });
  });
});

describe('Ollama preset', () => {
  it('forces managed mode and the Ollama OpenAI-compatible URL', () => {
    expect(
      buildModelPresetSettings(
        {
          ...DEFAULT_SETTINGS,
          serverMode: 'external',
          externalServerUrl: 'http://127.0.0.1:5222',
          modelUrl: LM_STUDIO_PRESET.modelUrl,
          modelId: LM_STUDIO_PRESET.modelId,
          modelApiKey: LM_STUDIO_PRESET.modelApiKey,
        },
        OLLAMA_PRESET,
      ),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      serverMode: 'managed',
      externalServerUrl: 'http://127.0.0.1:5222',
      modelUrl: OLLAMA_PRESET.modelUrl,
      modelId: OLLAMA_PRESET.modelId,
      modelApiKey: OLLAMA_PRESET.modelApiKey,
    });
  });
});
