import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { getCredentialProviderId } from '@mastra/code-sdk/providers/model-ids';
import { findSTTModel, resolveSTTModel, sttProviders } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey } from '@mastra/code-sdk/voice/transcribe';
import { classifyProviderError } from '@mastra/core/error';
import type { ProviderFailureKind } from '@mastra/core/error';

import type { CredentialRecord } from '../storage/domains/credentials/base.js';
import { effectiveModelScope, factoryProjectSettingsUserId } from '../storage/domains/projects/base.js';
import type { EffectiveModelScope, FactoryProject } from '../storage/domains/projects/base.js';
import type { VoiceSettingsStorage } from '../storage/domains/voice-settings/base.js';

/** Raw audio cap. Roughly half an hour of browser-recorded Opus. */
export const MAX_TRANSCRIBE_AUDIO_BYTES = 8 * 1024 * 1024;

const AUDIO_FILETYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
};

export function audioFiletype(mimeType: string): string {
  const [base = ''] = mimeType.split(';');
  return AUDIO_FILETYPES[base.trim().toLowerCase()] ?? 'webm';
}

export interface VoiceCaller {
  userKey(provider: string): string | undefined;
  orgKey(provider: string): string | undefined;
  settingsKey: { orgId: string; userId: string };
}

/** Only `api_key` credentials: OAuth subscriptions (e.g. ChatGPT via `openai-codex`) don't authorize transcription endpoints. */
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

export type VoiceFactory = Pick<FactoryProject, 'id' | 'orgId' | 'modelScope'>;

export function factoryVoiceSettingsKey(factory: VoiceFactory): { orgId: string; userId: string } {
  return { orgId: factory.orgId, userId: factoryProjectSettingsUserId(factory.id) };
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

export async function savedSTTModel(
  voiceSettings: VoiceSettingsStorage,
  key: { orgId: string; userId: string },
): Promise<STTModel | undefined> {
  await voiceSettings.ensureReady();
  const saved = await voiceSettings.get(key);
  return saved ? findSTTModel(saved.provider, saved.model) : undefined;
}

export type STTSelection = { entry: STTModel; apiKey: string };

export type STTChoice = STTSelection | { error: string };

/** A saved provider without a key is an error rather than a silent switch to another provider. */
export function chooseSTTModel(policy: VoicePolicy, saved: STTModel | undefined): STTChoice {
  if (saved) {
    const apiKey = policy.keyFor(saved.provider);
    return apiKey
      ? { entry: saved, apiKey }
      : {
          error: `Voice input needs a ${saved.provider} API key. Add one or pick another model in Settings → Models → Voice input.`,
        };
  }
  for (const provider of sttProviders()) {
    const apiKey = policy.keyFor(provider);
    if (apiKey) return { entry: resolveSTTModel(provider), apiKey };
  }
  return {
    error:
      'Voice input needs a speech-to-text API key (for example OpenAI or Mistral). Add one in Settings → Models → Voice input.',
  };
}

export async function transcribeAudio(selection: STTSelection, audio: Buffer, mimeType: string): Promise<string> {
  const transcriber = await createSTTTranscriber(selection.entry, selection.apiKey);
  return transcriber.transcribe(audio, audioFiletype(mimeType));
}

const PROVIDER_FAILURES: Partial<Record<ProviderFailureKind, string>> = {
  auth: 'the speech-to-text provider rejected the API key',
  quota: 'the speech-to-text provider account is out of credit',
  rate_limited: 'the speech-to-text provider is rate limiting requests, try again shortly',
  timeout: 'speech-to-text timed out',
  unavailable: 'the speech-to-text provider is unavailable, try again shortly',
};

/** Callers can be guests in a shared Slack thread, so raw provider text (bodies, key fragments) stays in the server log. */
export function transcriptionFailureReason(error: unknown): string {
  return PROVIDER_FAILURES[classifyProviderError(error)] ?? 'the speech-to-text provider returned an error';
}
