import { PassThrough } from 'stream';
import { MastraTTS } from '@mastra/core/tts';
import Azure from 'microsoft-cognitiveservices-speech-sdk';

import { voices } from './voices';
import type { VoiceId } from './voices';

interface AzureTTSConfig {
  name: VoiceId;
  apiKey?: string;
  region?: string;
}

export class AzureTTS extends MastraTTS {
  private client: Azure.SpeechSynthesizer;
  private speechConfig: Azure.SpeechConfig;

  constructor({ model }: { model: AzureTTSConfig }) {
    super({
      model: {
        provider: 'AZURE',
        ...model,
      },
    });

    const apiKey = process.env.AZURE_API_KEY || model.apiKey;
    const region = process.env.AZURE_REGION || model.region;

    if (!apiKey) {
      throw new Error('AZURE_API_KEY is not set');
    }

    if (!region) {
      throw new Error('AZURE_REGION is not set');
    }

    this.speechConfig = Azure.SpeechConfig.fromSubscription(apiKey, region);
    this.speechConfig.speechSynthesisVoiceName = this.model.name;
    this.client = new Azure.SpeechSynthesizer(this.speechConfig);
  }

  async voices() {
    return this.traced(() => voices.map(voice => ({ voice_id: voice })), 'tts.azure.voices')();
  }

  async generate({ voice, text }: { voice: string; text: string }) {
    const audio = await this.traced(async () => {
      if (voice !== this.model.name) {
        this.speechConfig.speechSynthesisVoiceName = voice;
        this.client = new Azure.SpeechSynthesizer(this.speechConfig);
      }

      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        this.client.speakTextAsync(
          text,
          result => {
            resolve(result.audioData);
          },
          error => {
            reject(error);
          },
        );
      });

      return Buffer.from(result);
    }, 'tts.azure.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text }: { voice: string; text: string }) {
    return this.traced(async () => {
      if (voice !== this.model.name) {
        this.speechConfig.speechSynthesisVoiceName = voice;
        this.client = new Azure.SpeechSynthesizer(this.speechConfig);
      }

      const stream = new PassThrough();

      this.client.speakTextAsync(
        text,
        result => {
          stream.write(Buffer.from(result.audioData));
          stream.end();
        },
        error => {
          stream.destroy(error as unknown as Error);
        },
      );

      return { audioResult: stream };
    }, 'tts.azure.stream')();
  }
}

export { voices };
export type { VoiceId, AzureTTSConfig };
