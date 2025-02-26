import { PassThrough } from 'stream';
import { createClient } from '@deepgram/sdk';
import type { SpeakSchema } from '@deepgram/sdk';
import { MastraTTS } from '@mastra/core/tts';

import { DEEPGRAM_VOICES } from './voices';
import type { DeepgramVoice, DeepgramModel } from './voices';

type DeepgramConfig = {
  name: DeepgramModel;
  voice?: DeepgramVoice;
  apiKey?: string;
  properties?: Omit<SpeakSchema, 'model'>;
};

export class DeepgramTTS extends MastraTTS {
  private client: ReturnType<typeof createClient>;
  private defaultVoice: DeepgramVoice;
  private defaultModel: DeepgramModel;
  private properties?: Omit<SpeakSchema, 'model'>;

  constructor({ model }: { model: DeepgramConfig }) {
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
    }, 'tts.deepgram.voices')();
  }

  async generate({ voice, text }: { voice?: string; text: string }) {
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
    }, 'tts.deepgram.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text }: { voice?: string; text: string }) {
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
      void (async () => {
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
    }, 'tts.deepgram.stream')();
  }
}

export type { DeepgramConfig, DeepgramVoice, DeepgramModel };

throw new Error(
  '@mastra/speech-deepgram is deprecated. Please use @mastra/voice-deepgram instead. ' +
    "Update your imports from '@mastra/speech-deepgram' to '@mastra/voice-deepgram'.",
);
