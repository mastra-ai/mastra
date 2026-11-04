/**
 * Speech-to-text for push-to-talk voice input (cloud path). The provider
 * clients live in `@mastra/code-sdk/voice/transcribe`; this layer picks the
 * `/voice` provider and model, resolves the key, and records as WAV.
 */

import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { resolveSTTModel } from '@mastra/code-sdk/voice/stt-registry';
import type { STTModel } from '@mastra/code-sdk/voice/stt-registry';
import { createSTTTranscriber, resolveSTTApiKey, sttApiKeyEnvVar } from '@mastra/code-sdk/voice/transcribe';

export class VoiceCredentialError extends Error {
  constructor(provider: string) {
    super(
      `Voice input needs a ${provider} API key. Set ${
        sttApiKeyEnvVar(provider) ?? `${provider.toUpperCase()}_API_KEY`
      } or add one with /api-keys (OAuth tokens are not supported for transcription).`,
    );
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

function resolveEntryAndKey(options: TranscribeOptions): { entry: STTModel; apiKey: string } {
  const entry = resolveSTTModel(options.provider, options.model);
  const apiKey = resolveSTTApiKey(entry.provider, options.authStorage);
  if (!apiKey) throw new VoiceCredentialError(entry.provider);
  return { entry, apiKey };
}

/**
 * Transcribe recorded WAV audio to text via the configured cloud provider.
 * Throws VoiceCredentialError if no API key is available for the provider.
 */
export async function transcribeAudio(audio: Buffer, options: TranscribeOptions = {}): Promise<string> {
  const { entry, apiKey } = resolveEntryAndKey(options);
  const transcriber = await createSTTTranscriber(entry, apiKey);
  return transcriber.transcribe(audio, 'wav');
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
  const { entry, apiKey } = resolveEntryAndKey(options);
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
