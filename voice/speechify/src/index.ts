import { MastraVoice } from '@mastra/core/voice';
import { type AudioSpeechRequest, type AudioStreamRequest, Speechify, type VoiceModelName } from '@speechify/api-sdk';
import { Readable } from 'stream';

import { SPEECHIFY_VOICES, type SpeechifyVoiceId } from './voices';

interface SpeechifyConfig {
  name: VoiceModelName;
  apiKey?: string;
  voice?: SpeechifyVoiceId;
}

export class SpeechifyVoice extends MastraVoice {
  client: Speechify;
  defaultVoice: SpeechifyVoiceId;

  constructor({ model }: { model: SpeechifyConfig }) {
    super({
      model: {
        provider: 'SPEECHIFY',
        ...model,
      },
    });

    const apiKey = process.env.SPEECHIFY_API_KEY || model.apiKey;
    if (!apiKey) {
      throw new Error('SPEECHIFY_API_KEY is not set');
    }

    this.client = new Speechify({ apiKey });
    this.defaultVoice = model.voice || 'george';
  }

  async voices() {
    return this.traced(() => SPEECHIFY_VOICES.map(voice => ({ voice_id: voice })), 'voice.speechify.voices')();
  }

  async speech({
    voice,
    text,
    properties,
  }: {
    voice?: string;
    text: string;
    properties?: Omit<AudioSpeechRequest, 'model' | 'voiceId' | 'input'>;
  }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audioGenerate({
        input: text,
        voiceId: (voice || this.defaultVoice) as SpeechifyVoiceId,
        model: this.model.name as VoiceModelName,
        audioFormat: 'mp3',
        ...properties,
      });

      // Convert Blob to Buffer
      const arrayBuffer = await response.audioData.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }, 'voice.speechify.speech')();

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
    properties?: Omit<AudioStreamRequest, 'model' | 'voiceId' | 'input'>;
  }) {
    return this.traced(async () => {
      const request: AudioStreamRequest = {
        input: text,
        model: this.model.name as VoiceModelName,
        voiceId: (voice || this.defaultVoice) as SpeechifyVoiceId,
        ...properties,
      };

      const webStream = await this.client.audioStream(request);
      const reader = webStream.getReader();

      // Convert Web ReadableStream to Node Readable stream
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

      // Clean up the reader when the stream ends
      nodeStream.on('end', () => {
        reader.releaseLock();
      });

      return { audioResult: nodeStream };
    }, 'voice.speechify.speechStream')();
  }
}

export type { SpeechifyConfig, SpeechifyVoiceId };
