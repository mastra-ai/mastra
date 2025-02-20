import { MastraVoice } from '@mastra/core/voice';
import { ElevenLabsClient } from 'elevenlabs';
import { PassThrough } from 'stream';

type ElevenLabsModel =
  | 'eleven_multilingual_v2'
  | 'eleven_flash_v2_5'
  | 'eleven_flash_v2'
  | 'eleven_multilingual_sts_v2'
  | 'eleven_english_sts_v2';

interface ElevenLabsVoiceConfig {
  name: ElevenLabsModel;
  apiKey?: string;
}

export class ElevenLabsVoice extends MastraVoice {
  private client: ElevenLabsClient;

  constructor({ model }: { model: ElevenLabsVoiceConfig }) {
    super({
      model: {
        provider: 'ELEVENLABS',
        ...model,
      },
    });

    const apiKey = process.env.ELEVENLABS_API_KEY || model.apiKey;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set');
    }

    this.client = new ElevenLabsClient({
      apiKey,
    });
  }

  async voices() {
    const res = await this.traced(async () => {
      const voices = await this.client.voices.getAll();
      return (
        voices?.voices?.map(voice => ({
          voice_id: voice.voice_id,
          name: voice.name,
          language: voice.labels?.language || 'en',
          gender: voice.labels?.gender || 'neutral',
        })) ?? []
      );
    }, 'voice.elevenlabs.voices')();

    return res;
  }

  async speech({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const audio = await this.client.generate({
        voice,
        text,
        model_id: this.model.name as ElevenLabsModel,
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    }, 'voice.elevenlabs.speech')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const stream = await this.client.generate({
        voice,
        text,
        model_id: this.model.name as ElevenLabsModel,
        stream: true,
      });

      const passThrough = new PassThrough();
      (async () => {
        try {
          for await (const chunk of stream) {
            passThrough.write(Buffer.from(chunk));
          }
          passThrough.end();
        } catch (error) {
          passThrough.destroy(error as Error);
        }
      })();

      return passThrough;
    }, 'voice.elevenlabs.speechStream')();

    return {
      audioResult: audio,
    };
  }

  // ElevenLabs doesn't support speech-to-text yet
  async transcribe({ audio }: { audio: Buffer | Blob }): Promise<{ text: string }> {
    throw new Error('ElevenLabs does not support speech-to-text');
  }

  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }): Promise<{ text: string }> {
    throw new Error('ElevenLabs does not support speech-to-text');
  }
}
