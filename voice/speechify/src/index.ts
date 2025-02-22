import { MastraVoice } from '@mastra/core/voice';
import { type AudioSpeechRequest, type AudioStreamRequest, Speechify, type VoiceModelName } from '@speechify/api-sdk';
import { Readable } from 'stream';

import { SPEECHIFY_VOICES, type SpeechifyVoiceId } from './voices';

interface SpeechifyConfig {
  name?: VoiceModelName;
  apiKey?: string;
}

export class SpeechifyVoice extends MastraVoice {
  private client: Speechify;

  constructor({ speechModel, speaker }: { speechModel?: SpeechifyConfig; speaker?: SpeechifyVoiceId } = {}) {
    super({
      speechModel: {
        name: speechModel?.name ?? 'simba-english',
        apiKey: speechModel?.apiKey ?? process.env.SPEECHIFY_API_KEY,
      },
      speaker: speaker ?? 'george',
    });

    const apiKey = speechModel?.apiKey ?? process.env.SPEECHIFY_API_KEY;
    if (!apiKey) {
      throw new Error('SPEECHIFY_API_KEY is not set');
    }

    this.client = new Speechify({ apiKey });
  }

  async getSpeakers() {
    return this.traced(
      () =>
        SPEECHIFY_VOICES.map(voice => ({
          voiceId: voice,
          name: voice,
        })),
      'voice.speechify.voices',
    )();
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
    } & Omit<AudioStreamRequest, 'voiceId' | 'input'>,
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    return this.traced(async () => {
      const request: AudioStreamRequest = {
        input: text,
        model: (options?.model || this.speechModel?.name) as VoiceModelName,
        voiceId: (options?.speaker || this.speaker) as SpeechifyVoiceId,
        ...options,
      };

      const webStream = await this.client.audioStream(request);
      const reader = webStream.getReader();

      const nodeStream = new Readable({
        read: async function () {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
            } else {
              this.push(value);
            }
          } catch (error) {
            this.destroy(error as Error);
          }
        },
      });

      nodeStream.on('end', () => {
        reader.releaseLock();
      });

      return nodeStream;
    }, 'voice.speechify.speak')();
  }

  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error('Speechify does not support speech recognition');
  }
}

export type { SpeechifyConfig, SpeechifyVoiceId };
