import { MastraVoice } from '@mastra/core/voice';
import ky from 'ky';
import { PassThrough } from 'stream';

import { MURF_VOICES, type MurfVoiceId } from './voices';

type MurfConfig = {
  name: 'GEN1' | 'GEN2';
  voice?: MurfVoiceId;
  apiKey?: string;
  properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;
};

type SpeechCreateParams = {
  voiceId: MurfVoiceId;
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

export class MurfVoice extends MastraVoice {
  private client: typeof ky;
  private defaultVoice: MurfVoiceId;

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
  }

  async voices() {
    return this.traced(async () => {
      return MURF_VOICES.map(voice => ({
        voice_id: voice,
        name: voice,
        language: voice.split('-')[0],
        gender: 'neutral',
      }));
    }, 'voice.murf.voices')();
  }

  async speech({
    voice,
    text,
    properties,
  }: {
    voice?: string;
    text: string;
    properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;
  }) {
    const audio = await this.traced(async () => {
      const response = await this.client
        .post('v1/speech/generate', {
          json: {
            voiceId: (voice || this.defaultVoice) as MurfVoiceId,
            text,
            modelVersion: this.model.name,
            ...properties,
          },
        })
        .json<SpeechCreateResponse>();

      const audioBlob = await this.client.get(response.audioFile).blob();
      // Convert Blob to Buffer for consistency with other TTS providers
      const arrayBuffer = await audioBlob.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }, 'voice.murf.speech')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({
    voice,
    text,
    properties,
  }: {
    voice?: string;
    text: string;
    properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;
  }) {
    return this.traced(async () => {
      const response = await this.client
        .post('v1/speech/generate', {
          json: {
            voiceId: (voice || this.defaultVoice) as MurfVoiceId,
            text,
            modelVersion: this.model.name,
            ...properties,
          },
        })
        .json<SpeechCreateResponse>();

      // Create a PassThrough stream for the audio
      const stream = new PassThrough();

      // Get the audio file as a stream
      const audioResponse = await fetch(response.audioFile);
      if (!audioResponse.body) {
        throw new Error('No response body received');
      }

      // Process the stream
      const reader = audioResponse.body.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              stream.end();
              break;
            }
            stream.write(value);
          }
        } catch (error) {
          stream.destroy(error as Error);
        }
      })();

      return { audioResult: stream };
    }, 'voice.murf.speechStream')();
  }

  async transcribe({ audio }: { audio: Buffer }): Promise<string> {
    throw new Error('Murf does not support speech-to-text');
  }

  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }): Promise<NodeJS.ReadableStream> {
    throw new Error('Murf does not support speech-to-text');
  }
}

export type { MurfConfig, MurfVoiceId };
