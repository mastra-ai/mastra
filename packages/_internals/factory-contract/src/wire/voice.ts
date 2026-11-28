import type { EffectiveModelScope, RealtimeSession } from './config-leaves.js';

export type ModelChoice = { provider: string; model: string };

export interface VoiceSettingsResponse {
  scope: EffectiveModelScope;
  selected: ModelChoice | null;
  canEdit: boolean;
  effective: ModelChoice | null;
  models: Array<ModelChoice & { label: string }>;
  /** `fromEnv`: local mode reads the key from the server environment, so it cannot be updated or removed here. */
  keys: Array<{ provider: string; envVar: string | undefined; saved: boolean; fromEnv: boolean }>;
}

export type TranscribeResponse = ModelChoice & { text: string };

export type LiveSessionResponse = { mode: 'batch' } | ({ mode: 'live' } & RealtimeSession);
