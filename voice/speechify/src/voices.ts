/**
 * Voices worth suggesting in an editor: the en-US staff picks and the other
 * `_32` voices. Speechify's catalog holds over a thousand voices and changes
 * often, so `getSpeakers()` reads it live instead of a bundled list. Any
 * catalog voice id is accepted; `simba-3.5` speaks every one of them.
 */
export const SPEECHIFY_FEATURED_VOICES = [
  'harper_32',
  'wyatt_32',
  'geffen_32',
  'dominic_32',
  'beatrice_32',
  'edmund_32',
  'hugh_32',
  'imogen_32',
  'george',
  'henry',
  'carly',
  'oliver',
] as const;

export type SpeechifyVoiceId = (typeof SPEECHIFY_FEATURED_VOICES)[number] | (string & Record<never, never>);
