export const SARVAM_VOICES = [
  'meera',
  'pavithra',
  'maitreyi',
  'arvind',
  'amol',
  'amartya',
  'diya',
  'neel',
  'misha',
  'vian',
  'arjun',
  'maya',
] as const;

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

export const SARVAM_TTS_MODELS = ['bulbul:v1'] as const;
export const SARVAM_STT_MODELS = ['saarika:v1', 'saarika:v2', 'saarika:flash'] as const;

export type SarvamVoiceId = (typeof SARVAM_VOICES)[number];

export type SarvamTTSLanguage = (typeof SARVAM_TTS_LANGUAGES)[number];
export type SarvamSTTLanguage = (typeof SARVAM_STT_LANGUAGES)[number];

export type SarvamTTSModel = (typeof SARVAM_TTS_MODELS)[number];
export type SarvamSTTModel = (typeof SARVAM_STT_MODELS)[number];
