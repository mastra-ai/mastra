export type CambSpeechModel = 'mars-flash' | 'mars-pro' | 'mars-instruct';

export type CambOutputFormat = 'wav' | 'flac' | 'adts' | 'pcm_s16le';

export interface CambConfig {
  name?: CambSpeechModel;
  apiKey?: string;
  outputFormat?: CambOutputFormat;
}

export interface CambSpeakOptions {
  speaker?: string;
  language?: string;
  userInstructions?: string;
  enhanceNamedEntities?: boolean;
}

export interface CambVoiceInfo {
  id: number;
  voice_name: string;
  age: string;
  gender: string;
  language: string;
  locale: string;
  samples: string[];
}

export const MODEL_SAMPLE_RATES: Record<CambSpeechModel, number> = {
  'mars-flash': 22050,
  'mars-pro': 48000,
  'mars-instruct': 22050,
};
