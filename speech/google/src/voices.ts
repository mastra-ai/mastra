/**
 * List of available voice models for text-to-speech
 * Each voice is identified by a locale code and voice type
 * Format: {language}-{region}-{voiceType}-{voiceId}
 * Example: en-US-Standard-A represents an English (US) voice with Standard quality and ID 'A'
 */
export const voices = [
  'af-ZA-Standard-A',
  'am-ET-Standard-A',
  'am-ET-Standard-B',
  'am-ET-Wavenet-A',
  'am-ET-Wavenet-B',
  // ... rest of the voices list
  'yue-HK-Standard-A',
  'yue-HK-Standard-B',
  'yue-HK-Standard-C',
  'yue-HK-Standard-D',
] as const;

export type VoiceId = (typeof voices)[number];
