import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey, sttApiKeyEnvVar } from '@mastra/code-sdk/voice/transcribe';

import type { CloudEngineOptions } from './engines/cloud-engine.js';

export function voiceCredentialMessage(provider: string): string {
  const envVar = sttApiKeyEnvVar(provider);
  const action = envVar ? `Set ${envVar} or add one with /api-keys` : 'Add one with /api-keys';
  return `Voice input needs a ${provider} API key. ${action} (OAuth tokens are not supported for transcription).`;
}

export class VoiceCredentialError extends Error {
  constructor(provider: string) {
    super(voiceCredentialMessage(provider));
    this.name = 'VoiceCredentialError';
  }
}

export interface ReusableTranscriber {
  transcribe(audio: Buffer): Promise<string>;
}

/** Throws `VoiceCredentialError` up front when the provider has no key. */
export function createTranscriber(options: CloudEngineOptions): ReusableTranscriber {
  const entry = resolveSTTModel(options.provider, options.model);
  const apiKey = resolveSTTApiKey(entry.provider, options.authStorage);
  if (!apiKey) throw new VoiceCredentialError(entry.provider);
  const transcriber = createSTTTranscriber(entry, apiKey);
  // A failed load surfaces from transcribe(); don't also report it as unhandled.
  transcriber.catch(() => {});
  return {
    async transcribe(audio: Buffer): Promise<string> {
      return (await transcriber).transcribe(audio, 'wav');
    },
  };
}

export function hasProviderCredential(provider: string, authStorage?: AuthStorage): boolean {
  return resolveSTTApiKey(provider, authStorage) !== undefined;
}
