import { PassThrough } from 'stream';
import { MastraTTS } from '@mastra/core/tts';

import { IamAuthenticator } from 'ibm-watson/auth';
import TextToSpeechV1 from 'ibm-watson/text-to-speech/v1';
import type { SynthesizeParams } from 'ibm-watson/text-to-speech/v1-generated';

import { IBM_VOICES } from './voices';
import type { IbmVoice } from './voices';

type IbmConfig = {
  voice?: IbmVoice;
  apiKey?: string;
  url?: string;
  properties?: Omit<SynthesizeParams, 'text' | 'voice'>;
};

export class IbmTTS extends MastraTTS {
  private client: TextToSpeechV1;
  private defaultVoice: IbmVoice;
  private properties?: Omit<SynthesizeParams, 'text' | 'voice'>;

  constructor({ model }: { model: IbmConfig }) {
    super({
      model: {
        provider: 'IBM',
        name: 'IBM',
        ...model,
      },
    });

    const apiKey = process.env.IBM_TTS_API_KEY || model.apiKey;
    const serviceUrl = process.env.IBM_TTS_URL || model.url;

    if (!apiKey) {
      throw new Error('IBM_TTS_API_KEY is not set');
    }

    if (!serviceUrl) {
      throw new Error('IBM_TTS_URL is not set');
    }

    const authenticator = new IamAuthenticator({ apikey: apiKey });
    this.client = new TextToSpeechV1({ authenticator, serviceUrl });
    this.defaultVoice = model.voice || 'en-US_AllisonV3Voice';
    this.properties = model.properties;
  }

  async voices() {
    return this.traced(async () => {
      return IBM_VOICES.map(voice => ({
        voice_id: voice,
        name: voice,
        language: voice.split('-')[0],
        gender: 'neutral',
      }));
    }, 'tts.ibm.voices')();
  }

  async generate({ voice, text }: { voice?: string; text: string }) {
    const audio = await this.traced(async () => {
      const response = await this.client.synthesize({
        text,
        accept: 'audio/mpeg',
        voice: (voice || this.defaultVoice) as IbmVoice,
        ...this.properties,
      });

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.result) {
        const part = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        chunks.push(new Uint8Array(part));
      }

      return Buffer.concat(chunks);
    }, 'tts.ibm.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text }: { voice?: string; text: string }) {
    return this.traced(async () => {
      const response = await this.client.synthesize({
        text,
        accept: 'audio/mpeg',
        voice: (voice || this.defaultVoice) as IbmVoice,
        ...this.properties,
      });

      const nodeStream = new PassThrough();

      // Process the stream
      void (async () => {
        try {
          for await (const chunk of response.result) {
            const part = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            nodeStream.write(new Uint8Array(part));
          }
          nodeStream.end();
        } catch (error) {
          nodeStream.destroy(error as Error);
        }
      })();

      return { audioResult: nodeStream };
    }, 'tts.ibm.stream')();
  }
}

export type { IbmConfig, IbmVoice };
