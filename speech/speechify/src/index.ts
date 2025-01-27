import { MastraTTS } from '@mastra/core';
import { type AudioSpeechRequest, Speechify, VoiceModelName } from '@speechify/api-sdk';
import { PassThrough } from 'stream';

import { SPEECHIFY_VOICES, type SpeechifyVoice } from './voices';

interface SpeechifyConfig {
  name: VoiceModelName;
  apiKey?: string;
  voice?: SpeechifyVoice;
  properties?: Omit<AudioSpeechRequest, 'model' | 'voiceId' | 'input'>;
}

export class SpeechifyTTS extends MastraTTS {
  client: Speechify;
  defaultVoice: SpeechifyVoice;
  properties?: Omit<AudioSpeechRequest, 'model' | 'voiceId' | 'input'>;

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
    this.properties = model.properties;
  }

  async voices() {
    return this.traced(() => SPEECHIFY_VOICES.map(voice => ({ voice_id: voice })), 'tts.speechify.voices')();
  }

  async generate({ voice, text }: { voice?: string; text: string }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audioGenerate({
        input: text,
        voiceId: (voice || this.defaultVoice) as SpeechifyVoice,
        model: this.model.name as VoiceModelName,
        audioFormat: 'mp3',
        ...this.properties,
      });

      // Convert Blob to Buffer
      const arrayBuffer = await response.audioData.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }, 'tts.speechify.generate')();

    return {
      audioResult: audio,
    };
  }

  // Note: Speechify doesn't support streaming directly, so we'll convert the buffer to a stream
  async stream({ voice, text }: { voice?: string; text: string }) {
    const { audioResult } = await this.generate({ voice, text });

    const stream = new PassThrough();
    stream.end(audioResult);

    return {
      audioResult: stream,
    };
  }
}

export type { SpeechifyConfig, SpeechifyVoice };
