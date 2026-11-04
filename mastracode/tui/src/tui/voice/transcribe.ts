/**
 * Speech-to-text for push-to-talk voice input (cloud path). The provider
 * clients live in `@mastra/code-sdk/voice/transcribe`; this layer picks the
 * `/voice` provider and model, resolves the key, and records as WAV.
 */

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey, sttApiKeyEnvVar } from '@mastra/code-sdk/voice/transcribe';

function credentialMessage(provider: string): string {
  const envVar = sttApiKeyEnvVar(provider);
  const action = envVar ? `Set ${envVar} or add one with /api-keys` : 'Add one with /api-keys';
  return `Voice input needs a ${provider} API key. ${action} (OAuth tokens are not supported for transcription).`;
}

export class VoiceCredentialError extends Error {
  constructor(provider: string) {
    super(credentialMessage(provider));
    this.name = 'VoiceCredentialError';
  }
}

export interface TranscribeOptions {
  /** STT provider id (see `stt-registry.ts`). Defaults to the registry default. */
  provider?: string;
  /** Model id within the provider. Defaults to the provider's default model. */
  model?: string;
  authStorage?: AuthStorage;
}

/**
 * A transcriber bound to one provider/model. Reusing one client keeps its
 * connection warm, which removes the DNS + TLS handshake from every
 * live-partial tick.
 */
export interface ReusableTranscriber {
  transcribe(audio: Buffer): Promise<string>;
}

/**
 * Resolves the provider/model and key once up front (throwing
 * `VoiceCredentialError` without a key), so a session can build it on start
 * and call `transcribe()` per tick.
 */
export function createTranscriber(options: TranscribeOptions = {}): ReusableTranscriber {
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
