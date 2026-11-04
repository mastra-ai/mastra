/**
 * Speech-to-text for the web composer's voice input. Providers and models come
 * from the shared STT registry (`@mastra/code-sdk/voice/stt-registry`), the
 * same catalog the TUI `/voice` command uses.
 *
 * Which model and key a caller transcribes with follows the Factory's model
 * scope, the same way chat models do:
 * - `factory`: the Factory's voice model and the org's keys.
 * - `user`: the caller's model (or the Factory's) and the caller's own keys.
 * - `hybrid`, or no Factory: the caller's model (or the Factory's), the
 *   caller's key first, then the org's.
 *
 * Only `api_key` credentials qualify: OAuth subscriptions (e.g. ChatGPT via
 * `openai-codex`) do not authorize the transcription endpoints.
 */

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { getCredentialProviderId } from '@mastra/code-sdk/providers/model-ids';
import { resolveSTTModel, STT_MODELS, sttProviders } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey } from '@mastra/code-sdk/voice/transcribe';

import type { CredentialRecord } from '../storage/domains/credentials/base.js';
import type { FactoryModelScope } from '../storage/domains/projects/base.js';
import { factoryVoiceSettingsUserId } from '../storage/domains/voice-settings/base.js';
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';

/** Raw audio cap. Roughly half an hour of browser-recorded Opus. */
export const MAX_TRANSCRIBE_AUDIO_BYTES = 8 * 1024 * 1024;

/** Map a browser recording MIME type to the file extension providers expect. */
export function audioFiletype(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  switch (base) {
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

/** Which key a provider resolves to and which saved choices apply, in order, under a Factory's model scope. */
export interface VoicePolicy {
  keyFor(provider: string): string | undefined;
  settingsKeys: Array<{ orgId: string; userId: string }>;
}

export function voicePolicy(caller: VoiceCaller, factory: VoiceFactory | undefined): VoicePolicy {
  if (!factory) {
    return { keyFor: p => caller.userKey(p) ?? caller.orgKey(p), settingsKeys: [caller.settingsKey] };
  }
  const factoryKey = factoryVoiceSettingsKey(factory);
  switch (factory.modelScope) {
    case 'factory':
      return { keyFor: p => caller.orgKey(p), settingsKeys: [factoryKey] };
    case 'user':
      return { keyFor: p => caller.userKey(p), settingsKeys: [caller.settingsKey, factoryKey] };
    case 'hybrid':
      return { keyFor: p => caller.userKey(p) ?? caller.orgKey(p), settingsKeys: [caller.settingsKey, factoryKey] };
  }
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

/** The first saved choice the policy honors (personal before the Factory's). */
async function policyModel(
  voiceSettings: VoiceSettingsStorage | undefined,
  policy: VoicePolicy,
): Promise<STTModel | undefined> {
  for (const key of policy.settingsKeys) {
    const saved = await savedSTTModel(voiceSettings, key);
    if (saved) return saved;
  }
  return undefined;
}

export type STTChoice = { entry: STTModel; apiKey: string } | { error: string };

/**
 * An explicit request wins, then the saved choice, then the first provider
 * with a key. A chosen provider without a key is an error rather than a
 * silent switch to another provider.
 */
export async function chooseSTTModel(
  policy: VoicePolicy,
  voiceSettings: VoiceSettingsStorage | undefined,
  requested: { provider?: string; model?: string } = {},
): Promise<STTChoice> {
  if (requested.provider && !sttProviders().includes(requested.provider)) {
    return { error: `${requested.provider} is not a supported speech-to-text provider.` };
  }
  const saved = requested.provider ? undefined : await policyModel(voiceSettings, policy);
  const chosen = requested.provider ?? saved?.provider;
  const provider = chosen ?? sttProviders().find(p => policy.keyFor(p) !== undefined);
  const apiKey = provider ? policy.keyFor(provider) : undefined;
  if (!provider || !apiKey) {
    return {
      error: chosen
        ? `Voice input needs a ${chosen} API key. Add one or pick another model in Settings → Models → Voice input.`
        : 'Voice input needs a speech-to-text API key (for example OpenAI or Mistral). Add one in Settings → Models → Voice input.',
    };
  }
  return { entry: resolveSTTModel(provider, requested.model ?? saved?.model), apiKey };
}

export async function transcribeAudio(
  choice: { entry: STTModel; apiKey: string },
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  const transcriber = await createSTTTranscriber(choice.entry, choice.apiKey);
  return transcriber.transcribe(audio, audioFiletype(mimeType));
}
