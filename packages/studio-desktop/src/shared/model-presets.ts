export const LOCAL_MODEL_PRESETS = {
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    modelUrl: 'http://localhost:1234/v1',
    modelId: 'lmstudio/openai/gpt-oss-20b',
    modelApiKey: 'not-needed',
    guidance: 'Start the LM Studio local server, then probe for loaded models.',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    modelUrl: 'http://localhost:11434/v1',
    modelId: 'llama3.2',
    modelApiKey: 'ollama',
    guidance: 'Start Ollama, pull a chat model, then probe the OpenAI-compatible endpoint.',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    modelUrl: '',
    modelId: '',
    modelApiKey: 'not-needed',
    guidance: 'Use any local OpenAI-compatible server that exposes /v1/models.',
  },
} as const;

export type LocalModelProviderId = keyof typeof LOCAL_MODEL_PRESETS;
export type LocalModelPreset = (typeof LOCAL_MODEL_PRESETS)[LocalModelProviderId];
