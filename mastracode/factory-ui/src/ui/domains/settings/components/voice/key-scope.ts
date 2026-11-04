import type { VoiceKeyStatus, VoiceSettings } from '../../../../../hooks/use-voice-settings';

/** Where a new key goes; absent lets the person choose (hybrid Factories use both). */
export type VoiceKeyScope = 'user' | 'org' | undefined;

/** Factory scope bills the organization, user scope each member; hybrid tries personal keys first. */
export function voiceKeyScope(modelScope: VoiceSettings['modelScope']): VoiceKeyScope {
  if (modelScope === 'factory') return 'org';
  if (modelScope === 'user') return 'user';
  return undefined;
}

export function hasVoiceKey(status: VoiceKeyStatus, scope: VoiceKeyScope): boolean {
  if (scope === 'org') return status.org;
  if (scope === 'user') return status.user;
  return status.user || status.org;
}
