/**
 * Engine factory: builds the active `STTEngine` from voice settings.
 */

import type { AuthStorage } from '../../../auth/storage.js';
import { CloudSTTEngine } from './cloud-engine.js';
import { MacosNativeSTTEngine } from './macos-native-engine.js';
import type { STTEngine, STTEngineKind } from './types.js';

export interface EngineSettings {
  engine: STTEngineKind;
  provider: string;
  model?: string;
}

export function createSTTEngine(settings: EngineSettings, authStorage?: AuthStorage): STTEngine {
  if (settings.engine === 'macos-native') {
    return new MacosNativeSTTEngine();
  }
  return new CloudSTTEngine({ provider: settings.provider, model: settings.model, authStorage });
}

export * from './types.js';
export { CloudSTTEngine } from './cloud-engine.js';
export { MacosNativeSTTEngine } from './macos-native-engine.js';
