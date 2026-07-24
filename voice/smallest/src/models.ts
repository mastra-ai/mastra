/**
 * Smallest AI ships a large, frequently-updated voice catalog (200+ on the Pro
 * pool), so voice ids are plain strings resolved at runtime through
 * `getSpeakers()` rather than a hand-maintained union that would go stale.
 * Model names are small and stable, so those are typed.
 */

export const SMALLEST_TTS_MODELS = ['lightning_v3.1', 'lightning_v3.1_pro'] as const;
export type SmallestTTSModel = (typeof SMALLEST_TTS_MODELS)[number];

export const SMALLEST_STT_MODELS = ['pulse', 'pulse-pro'] as const;
export type SmallestSTTModel = (typeof SMALLEST_STT_MODELS)[number];

export const SMALLEST_OUTPUT_FORMATS = ['wav', 'mp3', 'pcm', 'ulaw', 'alaw'] as const;
export type SmallestOutputFormat = (typeof SMALLEST_OUTPUT_FORMATS)[number];

/** Sample rates the Lightning models accept, in Hz. 44100 is native. */
export type SmallestSampleRate = 8000 | 16000 | 22050 | 24000 | 32000 | 44100;

/** Voice metadata as returned by the catalog endpoint. */
export interface SmallestVoiceTags {
  language?: string[];
  accent?: string;
  gender?: string;
  age?: string;
  emotions?: string[];
  usecases?: string[];
  recommendedLanguages?: string[];
}
