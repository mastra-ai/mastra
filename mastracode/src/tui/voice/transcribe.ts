/**
 * Speech-to-text transcription for push-to-talk voice input.
 *
 * Resolves an OpenAI API key (from stored credentials or the environment) and
 * transcribes recorded WAV audio via the AI SDK's transcribe() using OpenAI's
 * whisper-1 model.
 *
 * Note: OpenAI OAuth (Codex) tokens cannot be used for the audio transcription
 * REST endpoint, so a real OpenAI API key is required.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { experimental_transcribe as transcribe } from 'ai';
import type { AuthStorage } from '../../auth/storage.js';

const TRANSCRIPTION_MODEL = 'whisper-1';

export class VoiceCredentialError extends Error {
  constructor() {
    super(
      'Voice input needs an OpenAI API key. Set OPENAI_API_KEY or add one with /login (OpenAI OAuth tokens are not supported for transcription).',
    );
    this.name = 'VoiceCredentialError';
  }
}

/**
 * Resolve an OpenAI API key for transcription.
 * Prefers a stored API key, then falls back to the environment variable.
 */
export function resolveOpenAIApiKey(authStorage?: AuthStorage): string | undefined {
  const stored = authStorage?.getStoredApiKey('openai');
  if (stored) return stored;
  const fromEnv = process.env.OPENAI_API_KEY?.trim();
  return fromEnv || undefined;
}

/**
 * Transcribe recorded audio to text.
 * Throws VoiceCredentialError if no OpenAI API key is available.
 */
export async function transcribeAudio(
  audio: Buffer,
  options: { authStorage?: AuthStorage; abortSignal?: AbortSignal } = {},
): Promise<string> {
  const apiKey = resolveOpenAIApiKey(options.authStorage);
  if (!apiKey) {
    throw new VoiceCredentialError();
  }

  const openai = createOpenAI({ apiKey });
  const result = await transcribe({
    model: openai.transcription(TRANSCRIPTION_MODEL),
    audio,
    abortSignal: options.abortSignal,
  });

  return result.text.trim();
}
