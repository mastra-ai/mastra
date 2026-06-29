// Speakers available for bulbul:v3 (39 voices)
export const SARVAM_BULBUL_V3_SPEAKERS = [
  'shubh',
  'aditya',
  'ritu',
  'priya',
  'neha',
  'rahul',
  'pooja',
  'rohan',
  'simran',
  'kavya',
  'amit',
  'dev',
  'ishita',
  'shreya',
  'ratan',
  'varun',
  'manan',
  'sumit',
  'roopa',
  'kabir',
  'aayan',
  'ashutosh',
  'advait',
  'amelia',
  'sophia',
  'anand',
  'tanya',
  'tarun',
  'sunny',
  'mani',
  'gokul',
  'vijay',
  'shruti',
  'suhani',
  'mohit',
  'kavitha',
  'rehan',
  'soham',
  'rupali',
] as const;

// Speakers available for bulbul:v2 (7 voices, no overlap with v3)
export const SARVAM_BULBUL_V2_SPEAKERS = [
  'anushka',
  'manisha',
  'vidya',
  'arya',
  'abhilash',
  'karun',
  'hitesh',
] as const;

// Combined list of all Sarvam speakers across supported bulbul models.
// bulbul:v1 speakers (meera, pavithra, …) have been removed as Sarvam
// deprecated bulbul:v1 — use bulbul:v2 or bulbul:v3 instead.
export const SARVAM_VOICES = [...SARVAM_BULBUL_V3_SPEAKERS, ...SARVAM_BULBUL_V2_SPEAKERS] as const;

export const SARVAM_TTS_LANGUAGES = [
  'hi-IN',
  'bn-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'od-IN',
  'pa-IN',
  'ta-IN',
  'te-IN',
  'en-IN',
  'gu-IN',
] as const;

export const SARVAM_STT_LANGUAGES = [...SARVAM_TTS_LANGUAGES, 'unknown'] as const;

// Current TTS models. bulbul:v1 was deprecated and removed by Sarvam.
// bulbul:v3-beta is a beta variant of bulbul:v3 that shares the same speaker catalog.
export const SARVAM_TTS_MODELS = ['bulbul:v2', 'bulbul:v3', 'bulbul:v3-beta'] as const;

// Current STT models. saarika:v1, saarika:v2, and saarika:flash were deprecated.
// saaras:v3 is a multi-mode model that supports transcribe/translate/verbatim/translit/codemix
// via the `mode` option and is served from the same POST /speech-to-text endpoint.
export const SARVAM_STT_MODELS = ['saarika:v2.5', 'saaras:v3'] as const;

// Operation modes supported by saaras:v3 only.
export const SARVAM_STT_MODES = ['transcribe', 'translate', 'verbatim', 'translit', 'codemix'] as const;

export type SarvamVoiceId = (typeof SARVAM_VOICES)[number];

export type SarvamTTSLanguage = (typeof SARVAM_TTS_LANGUAGES)[number];
export type SarvamSTTLanguage = (typeof SARVAM_STT_LANGUAGES)[number];

export type SarvamTTSModel = (typeof SARVAM_TTS_MODELS)[number];
export type SarvamSTTModel = (typeof SARVAM_STT_MODELS)[number];
export type SarvamSTTMode = (typeof SARVAM_STT_MODES)[number];
