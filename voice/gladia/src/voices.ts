export const NEW_PROVIDER_VOICES = [
  'default', // Replace with actual voice IDs
] as const;

export type NewProviderVoiceId = (typeof NEW_PROVIDER_VOICES)[number];
