/**
 * List of available Deepgram voice models for text-to-speech
 * Each voice is designed for specific use cases and languages
 * Format: {name}-{language} (e.g. asteria-en)
 */
export const DEEPGRAM_VOICES = [
  'asteria-en',
  'luna-en',
  'stella-en',
  'athena-en',
  'hera-en',
  'orion-en',
  'arcas-en',
  'perseus-en',
  'angus-en',
  'orpheus-en',
  'helios-en',
  'zeus-en',
] as const;

export type DeepgramVoiceId = (typeof DEEPGRAM_VOICES)[number];

/**
 * List of available Deepgram models for text-to-speech and speech-to-text
 */
export const DEEPGRAM_MODELS = ['aura', 'whisper', 'base', 'enhanced', 'nova', 'nova-2', 'nova-3'] as const;

export type DeepgramModel = (typeof DEEPGRAM_MODELS)[number];
