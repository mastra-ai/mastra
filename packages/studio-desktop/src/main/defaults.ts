import { LOCAL_MODEL_PRESETS } from '../shared/model-presets';
import type { DesktopSettings } from '../shared/types';

export const LOCALHOST = '127.0.0.1';
export const DEFAULT_RUNTIME_PORT = 4111;
export const DEFAULT_STUDIO_PORT = 3133;
export const DEFAULT_MODEL_URL = LOCAL_MODEL_PRESETS.lmstudio.modelUrl;
export const DEFAULT_MODEL_ID = LOCAL_MODEL_PRESETS.lmstudio.modelId;
export const DEFAULT_MODEL_API_KEY = LOCAL_MODEL_PRESETS.lmstudio.modelApiKey;
export const OLLAMA_MODEL_URL = LOCAL_MODEL_PRESETS.ollama.modelUrl;
export const OLLAMA_MODEL_ID = LOCAL_MODEL_PRESETS.ollama.modelId;
export const OLLAMA_MODEL_API_KEY = LOCAL_MODEL_PRESETS.ollama.modelApiKey;
export const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:4111';
export const DEFAULT_PLATFORM_BASE_URL = 'https://platform.mastra.ai';

export const DEFAULT_SETTINGS: DesktopSettings = {
  version: 3,
  serverMode: 'managed',
  devServerUrl: DEFAULT_DEV_SERVER_URL,
  platformBaseUrl: DEFAULT_PLATFORM_BASE_URL,
  modelUrl: DEFAULT_MODEL_URL,
  modelId: DEFAULT_MODEL_ID,
  modelApiKey: DEFAULT_MODEL_API_KEY,
  environmentVariables: {},
};
