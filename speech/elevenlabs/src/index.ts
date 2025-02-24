import { MastraTTS } from '@mastra/core/tts';
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
    const res = await this.traced(() => this.client.voices.getAll(), 'tts.elevenlabs.voices')();

    return res?.voices ?? [];
  }

  async generate({ voice, text }: { voice: string; text: string }) {
    const audio = await this.traced(async () => {
      const audio = await this.client.generate({
        voice,
        text,
        model_id: this.model.name,
      });

      const chunks: Buffer[] = [];

      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);

      return audioBuffer;
    }, 'tts.elevenlabs.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text }: { voice: string; text: string }) {
    const audio = await this.traced(
      () =>
        this.client.generate({
          voice,
          text,
          model_id: this.model.name,
          stream: true,
        }),
      'tts.elevenlabs.stream',
    )();

    return {
      audioResult: audio,
    };
  }
}

throw new Error(
  '@mastra/speech-elevenlabs is deprecated. Please use @mastra/voice-elevenlabs instead. ' +
    "Update your imports from '@mastra/speech-elevenlabs' to '@mastra/voice-elevenlabs'.",
);
