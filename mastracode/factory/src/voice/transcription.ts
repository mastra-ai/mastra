/** Only `api_key` credentials qualify: OAuth subscriptions (e.g. ChatGPT via `openai-codex`) don't authorize transcription endpoints. */

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { getCredentialProviderId } from '@mastra/code-sdk/providers/model-ids';
import { resolveSTTModel, STT_MODELS, sttProviders } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey } from '@mastra/code-sdk/voice/transcribe';

import type { CredentialRecord } from '../storage/domains/credentials/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { EffectiveModelScope, FactoryModelScope } from '../storage/domains/projects/base.js';
import { factoryVoiceSettingsUserId } from '../storage/domains/voice-settings/base.js';
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';

/** Raw audio cap. Roughly half an hour of browser-recorded Opus. */
export const MAX_TRANSCRIBE_AUDIO_BYTES = 8 * 1024 * 1024;

/** Map a browser recording MIME type to the file extension providers expect. */
export function audioFiletype(mimeType: string): string {
  const [base = ''] = mimeType.split(';');
  switch (base.trim().toLowerCase()) {
    case 'audio/webm':
    case 'video/webm':
      return 'webm';
    case 'audio/mp4':
    case 'audio/x-m4a':
    case 'audio/m4a':
      return 'm4a';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav':
    case 'audio/wave':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default:
      return 'webm';
  }
}

/** The keys a caller holds at each storage scope, plus where their personal model choice lives. */
export interface VoiceCaller {
  userKey(provider: string): string | undefined;
  orgKey(provider: string): string | undefined;
  settingsKey: { orgId: string; userId: string };
}

function apiKeyAt(records: CredentialRecord[], scope: 'user' | 'org', provider: string): string | undefined {
  const id = getCredentialProviderId(provider);
  const record = records.find(r => r.scope === scope && r.provider === id && r.credential.type === 'api_key');
  return record?.credential.type === 'api_key' && record.credential.key ? record.credential.key : undefined;
}

export function tenantVoiceCaller(records: CredentialRecord[], orgId: string, userId: string): VoiceCaller {
  return {
    userKey: provider => apiKeyAt(records, 'user', provider),
    orgKey: provider => apiKeyAt(records, 'org', provider),
    settingsKey: { orgId, userId },
  };
}

/** Local (no-auth) mode is single-user: env vars first, then the file-backed key store, at every scope. */
export function localVoiceCaller(authStorage: AuthStorage | undefined): VoiceCaller {
  const keyFor = (provider: string) => resolveSTTApiKey(provider, authStorage);
  return { userKey: keyFor, orgKey: keyFor, settingsKey: { orgId: 'local', userId: 'local' } };
}

/** The Factory a transcription runs under, when the caller names one. */
export interface VoiceFactory {
  id: string;
  orgId: string;
  modelScope: FactoryModelScope;
}

export function factoryVoiceSettingsKey(factory: VoiceFactory): { orgId: string; userId: string } {
  return { orgId: factory.orgId, userId: factoryVoiceSettingsUserId(factory.id) };
}

/** Like an interactive chat: `factory` scope bills the Factory's model and org keys, anything else the caller's own. */
export interface VoicePolicy {
  scope: EffectiveModelScope;
  keyFor(provider: string): string | undefined;
  settingsKey: { orgId: string; userId: string };
}

export function voicePolicy(caller: VoiceCaller, factory: VoiceFactory | undefined): VoicePolicy {
  if (factory && effectiveModelScope(factory.modelScope, 'session') === 'factory') {
    return { scope: 'factory', keyFor: p => caller.orgKey(p), settingsKey: factoryVoiceSettingsKey(factory) };
  }
  return { scope: 'user', keyFor: p => caller.userKey(p), settingsKey: caller.settingsKey };
}

/** A saved choice, if storage holds one the registry still lists. */
export async function savedSTTModel(
  voiceSettings: VoiceSettingsStorage | undefined,
  key: { orgId: string; userId: string },
): Promise<STTModel | undefined> {
  if (!voiceSettings) return undefined;
  await voiceSettings.ensureReady();
  const saved = await voiceSettings.get(key);
  return saved ? STT_MODELS.find(m => m.provider === saved.provider && m.model === saved.model) : undefined;
}

export type STTChoice = { entry: STTModel; apiKey: string } | { error: string };

/**
 * The saved choice wins, then the first provider with a key. A saved provider
 * without a key is an error rather than a silent switch to another provider.
 */
export async function chooseSTTModel(
  policy: VoicePolicy,
  voiceSettings: VoiceSettingsStorage | undefined,
): Promise<STTChoice> {
  const saved = await savedSTTModel(voiceSettings, policy.settingsKey);
  const provider = saved?.provider ?? sttProviders().find(p => policy.keyFor(p) !== undefined);
  const apiKey = provider ? policy.keyFor(provider) : undefined;
  if (!provider || !apiKey) {
    return {
      error: saved
        ? `Voice input needs a ${saved.provider} API key. Add one or pick another model in Settings → Models → Voice input.`
        : 'Voice input needs a speech-to-text API key (for example OpenAI or Mistral). Add one in Settings → Models → Voice input.',
    };
  }
  return { entry: saved ?? resolveSTTModel(provider), apiKey };
}

export async function transcribeAudio(
  choice: { entry: STTModel; apiKey: string },
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const transcriber = await createSTTTranscriber(choice.entry, choice.apiKey);
  return transcriber.transcribe(audio, audioFiletype(mimeType));
}
