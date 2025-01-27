import { MastraTTS } from '@mastra/core';
import ky from 'ky';

import { MURF_VOICES, type MurfVoice } from './voices';

type MurfConfig = {
  model: 'GEN1' | 'GEN2';
  voice?: MurfVoice;
  apiKey?: string;
  properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;
};

type SpeechCreateParams = {
  voiceId: MurfVoice;
  style: string;
  text: string;
  rate: number;
  pitch: number;
  sampleRate: 8000 | 24000 | 44100 | 48000;
  format: 'MP3' | 'WAV' | 'FLAC' | 'ALAW' | 'ULAW';
  channelType: 'STEREO' | 'MONO';
  pronunciationDictionary: Record<string, string>;
  encodeAsBase64: boolean;
  variation: number;
  audioDuration: number;
  modelVersion: 'GEN1' | 'GEN2';
  multiNativeLocale: string;
};

type SpeechCreateResponse = {
  audioFile: string;
  audioLengthInSeconds: number;
  consumedCharacterCount: number;
  encodedAudio: string;
  remainingCharacterCount: number;
  warning: string;
  wordDurations: {
    endMs: number;
    pitchScaleMaximum: number;
    pitchScaleMinimum: number;
    sourceWordIndex: number;
    startMs: number;
    word: string;
  }[];
};

export class MurfTTS extends MastraTTS {
  private client: typeof ky;
  private defaultVoice: MurfVoice;
  private properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;
  private model: MurfConfig;

  constructor({ model }: { model: MurfConfig }) {
    super({
      model: {
        provider: 'MURF',
        ...model,
      },
    });

    const apiKey = process.env.MURF_API_KEY || model.apiKey;
    if (!apiKey) {
      throw new Error('MURF_API_KEY is not set');
    }

    this.client = ky.create({
      prefixUrl: 'https://api.murf.ai',
      headers: {
        'api-key': apiKey,
      },
    });

    this.defaultVoice = model.voice || 'en-US-natalie';
    this.properties = model.properties;
    this.model = model;
  }

  async voices() {
    return this.traced(async () => {
      return MURF_VOICES.map(voice => ({
        voice_id: voice,
        name: voice,
        language: voice.split('-')[0],
        gender: 'neutral',
      }));
    }, 'tts.murf.voices')();
  }

  async generate({ voice, text }: { voice?: string; text: string }) {
    const audio = await this.traced(async () => {
      const response = await this.client
        .post('v1/speech/generate', {
          json: {
            voiceId: (voice || this.defaultVoice) as MurfVoice,
            text,
            modelVersion: this.model.model,
            ...this.properties,
          },
        })
        .json<SpeechCreateResponse>();

      const audioBlob = await this.client.get(response.audioFile).blob();
      // Convert Blob to Buffer for consistency with other TTS providers
      const arrayBuffer = await audioBlob.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }, 'tts.murf.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text }: { voice?: string; text: string }) {
    const { audioResult } = await this.generate({ voice, text });
    const stream = new PassThrough();
    stream.end(audioResult);
    return {
      audioResult: stream,
    };
  }
}

export type { MurfConfig, MurfVoice };
