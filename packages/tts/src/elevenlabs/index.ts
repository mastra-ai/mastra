import { MastraTTS } from '@mastra/core';
import { ElevenLabsClient } from 'elevenlabs';

interface ElevenLabsTTSConfig {
  name:
    | 'eleven_multilingual_v2'
    | 'eleven_flash_v2_5'
    | 'eleven_flash_v2'
    | 'eleven_multilingual_sts_v2'
    | 'eleven_english_sts_v2';
  apiKey?: string;
}

export class ElevenLabsTTS extends MastraTTS {
  client: ElevenLabsClient;
  constructor({ model }: { model: ElevenLabsTTSConfig }) {
    super({
      model: {
        provider: 'ELEVENLABS',
        ...model,
      },
    });

    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY || this.model.apiKey,
    });
  }

  async voices() {
    const res = await this.client.voices.getAll();

    return res?.voices ?? [];
  }

  async generate({ voice, text }: { voice: string; text: string }) {
    return this.client.generate({
      voice,
      text,
      model_id: this.model.name,
    });
  }

  async stream({ voice, text }: { voice: string; text: string }) {
    return this.client.generate({
      voice,
      text,
      model_id: this.model.name,
      stream: true,
    });
  }
}
