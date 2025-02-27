import type { PassThrough } from 'stream';
import { MastraTTS } from '@mastra/core/tts';
import OpenAI from 'openai';

interface OpenAITTSConfig {
  name: 'tts-1' | 'tts-1-hd';
  apiKey?: string;
}

throw new Error(
  '@mastra/speech-openai is deprecated. Please use @mastra/voice-openai instead, which provides both Text-to-Speech and Speech-to-Text capabilities.',
);

export class OpenAITTS extends MastraTTS {
  client: OpenAI;
  constructor({ model }: { model: OpenAITTSConfig }) {
    super({
      model: {
        provider: 'OPENAI',
        ...model,
      },
    });

    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || this.model.apiKey });
  }

  async voices() {
    const res = this.traced(
      () => [
        { voice_id: 'alloy' },
        { voice_id: 'echo' },
        { voice_id: 'fable' },
        { voice_id: 'onyx' },
        { voice_id: 'nova' },
        { voice_id: 'shimmer' },
      ],
      'tts.openai.voices',
    )();

    return res;
  }

  async generate({ voice, text, speed }: { voice: string; text: string; speed?: number }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audio.speech.create({
        model: this.model.name,
        voice: voice as any,
        input: text,
        speed: speed || 1.0,
      });

      // Get the full buffer
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    }, 'tts.openai.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text, speed }: { voice: string; text: string; speed?: number }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audio.speech.create({
        model: this.model.name || 'tts-1',
        voice: voice as any,
        input: text,
        speed: speed || 1.0,
      });

      return response.body as unknown as PassThrough;
    }, 'tts.openai.stream')();

    return {
      audioResult: audio,
    };
  }
}
