import type { DesktopSettings } from '../shared/types';

export const LOCALHOST = '127.0.0.1';
export const DEFAULT_RUNTIME_PORT = 4111;
export const DEFAULT_STUDIO_PORT = 3133;
export const DEFAULT_MODEL_URL = 'http://localhost:1234/v1';
export const DEFAULT_MODEL_ID = 'lmstudio/openai/gpt-oss-20b';
export const DEFAULT_MODEL_API_KEY = 'not-needed';
export const DEFAULT_DEV_SERVER_URL = 'http://127.0.0.1:4111';
export const DEFAULT_PLATFORM_BASE_URL = 'https://platform.mastra.ai';

export const DEFAULT_SETTINGS: DesktopSettings = {
  version: 2,
  serverMode: 'managed',
  devServerUrl: DEFAULT_DEV_SERVER_URL,
  platformBaseUrl: DEFAULT_PLATFORM_BASE_URL,
  modelUrl: DEFAULT_MODEL_URL,
  modelId: DEFAULT_MODEL_ID,
  modelApiKey: DEFAULT_MODEL_API_KEY,
};
