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

export const SARVAM_LANGUAGES = [
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

export const SARVAM_MODELS = ['bulbul:v1'] as const;

export type SarvamVoiceId = (typeof SARVAM_VOICES)[number];
export type SarvamLanguage = (typeof SARVAM_LANGUAGES)[number];
export type SarvamModel = (typeof SARVAM_MODELS)[number];
