import { type SpeakSchema, createClient } from '@deepgram/sdk';
import { MastraVoice } from '@mastra/core/voice';
import { PassThrough } from 'stream';

import { DEEPGRAM_VOICES, type DeepgramVoiceId, type DeepgramModel } from './voices';

type DeepgramVoiceConfig = {
  name: DeepgramModel;
  voice?: DeepgramVoiceId;
  apiKey?: string;
  properties?: Omit<SpeakSchema, 'model'>;
};

export class DeepgramVoice extends MastraVoice {
  private client: ReturnType<typeof createClient>;
  private defaultVoice: DeepgramVoiceId;
  private defaultModel: DeepgramModel;
  private properties?: Omit<SpeakSchema, 'model'>;

  constructor({ model }: { model: DeepgramVoiceConfig }) {
    super({
      model: {
        provider: 'DEEPGRAM',
        ...model,
      },
    });

    const apiKey = process.env.DEEPGRAM_API_KEY || model.apiKey;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set');
    }

    this.client = createClient(apiKey);
    this.defaultVoice = model.voice || 'asteria-en';
    this.defaultModel = model.name || 'aura';
    this.properties = model.properties;
  }

  async voices() {
    return this.traced(async () => {
      return DEEPGRAM_VOICES.map(voice => ({
        voice_id: voice,
        name: voice,
        language: voice.split('-')[1],
        gender: 'neutral',
      }));
    }, 'voice.deepgram.voices')();
  }

  async speech({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const parsedModel = `${this.defaultModel}-${voice || this.defaultVoice}`;
      const response = await this.client.speak.request({ text }, { model: parsedModel, ...this.properties });

      const stream = await response.getStream();
      if (!stream) {
        throw new Error('No stream returned from Deepgram');
      }

      const read = stream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await read.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);
    }, 'voice.deepgram.speech')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({ text, voice }: { text: string; voice?: string }) {
    return this.traced(async () => {
      const parsedModel = `${this.defaultModel}-${voice || this.defaultVoice}`;
      const response = await this.client.speak.request({ text }, { model: parsedModel, ...this.properties });

      const webStream = await response.getStream();
      if (!webStream) {
        throw new Error('No stream returned from Deepgram');
      }

      const reader = webStream.getReader();
      const nodeStream = new PassThrough();

      // Read from web stream and write to node stream
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              nodeStream.end();
              break;
            }
            nodeStream.write(value);
          }
        } catch (error) {
          nodeStream.destroy(error as Error);
        }
      })();

      return { audioResult: nodeStream };
    }, 'voice.deepgram.speechStream')();
  }

  async transcribe({ audio }: { audio: Buffer | Blob }) {
    return this.traced(async () => {
      throw new Error('Transcription not supported by Deepgram TTS API');
    }, 'voice.deepgram.transcribe')();
  }

  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }) {
    return this.traced(async () => {
      throw new Error('Streaming transcription not supported by Deepgram TTS API');
    }, 'voice.deepgram.transcribeStream')();
  }
}

export type { DeepgramVoiceConfig, DeepgramVoiceId, DeepgramModel };
