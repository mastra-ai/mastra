/**
 * List of available IBM Watson voice models for text-to-speech
 * Includes both Expressive and V3 voices in various languages and regions
 * Format examples:
 * - Expressive voices: {language}-{region}_{name}Expressive (e.g. en-US_AllisonExpressive)
 * - V3 voices: {language}-{region}_{name}V3Voice (e.g. en-US_AllisonV3Voice)
 */
export const IBM_VOICES = [
  'en-AU_HeidiExpressive',
  'en-AU_JackExpressive',
  'en-US_AllisonExpressive',
  'en-US_EmmaExpressive',
  'en-US_LisaExpressive',
  'en-US_MichaelExpressive',
  'en-GB_GeorgeExpressive',
  'es-LA_DanielaExpressive',
  'nl-NL_MerelV3Voice',
  'en-GB_CharlotteV3Voice',
  'en-GB_JamesV3Voice',
  'en-GB_KateV3Voice',
  'en-US_AllisonV3Voice',
  'en-US_EmilyV3Voice',
  'en-US_HenryV3Voice',
  'en-US_KevinV3Voice',
  'en-US_LisaV3Voice',
  'en-US_MichaelV3Voice',
  'en-US_OliviaV3Voice',
  'fr-CA_LouiseV3Voice',
  'fr-FR_NicolasV3Voice',
  'fr-FR_ReneeV3Voice',
  'de-DE_BirgitV3Voice',
  'de-DE_DieterV3Voice',
  'de-DE_ErikaV3Voice',
  'it-IT_FrancescaV3Voice',
  'ja-JP_EmiV3Voice',
  'ko-KR_JinV3Voice',
  'pt-BR_IsabelaV3Voice',
  'es-ES_EnriqueV3Voice',
  'es-ES_LauraV3Voice',
  'es-LA_SofiaV3Voice',
  'es-US_SofiaV3Voice',
] as const;

export type IbmVoice = (typeof IBM_VOICES)[number];
