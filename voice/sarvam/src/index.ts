import { PassThrough } from 'stream';

import { MastraVoice } from '@mastra/core/voice';
import { SARVAM_VOICES } from './voices';
import type { SarvamLanguage, SarvamModel, SarvamVoiceId } from './voices';

interface SarvamVoiceConfig {
  apiKey?: string;
  model?: SarvamModel;
  language?: SarvamLanguage;
  properties?: {
    pitch?: number;
    pace?: number;
    loudness?: number;
    speech_sample_rate?: 8000 | 16000 | 22050;
    enable_preprocessing?: boolean;
    eng_interpolation_wt?: number;
  };
}

export class SarvamVoice extends MastraVoice {
  private apiKey?: string;
  private model: SarvamModel = 'bulbul:v1';
  private language: SarvamLanguage = 'en-IN';
  private properties: Record<string, any> = {};
  protected speaker: SarvamVoiceId = 'meera';
  private baseUrl = 'https://api.sarvam.ai';

  constructor({
    speechModel,
    speaker,
  }: {
    speechModel?: SarvamVoiceConfig;
    speaker?: SarvamVoiceId;
  } = {}) {
    const defaultSpeechModel = {
      model: 'bulbul:v1' as const,
      apiKey: process.env.SARVAM_API_KEY,
      language: 'en-IN' as const,
    };
    super({
      speechModel: {
        name: speechModel?.model ?? defaultSpeechModel.model,
        apiKey: speechModel?.apiKey ?? defaultSpeechModel.apiKey,
      },
      speaker,
    });

    this.apiKey = speechModel?.apiKey || defaultSpeechModel.apiKey;
    if (!this.apiKey) {
      throw new Error('SARVAM_API_KEY must be set');
    }
    this.model = speechModel?.model || defaultSpeechModel.model;
    this.language = speechModel?.language || defaultSpeechModel.language;
    this.properties = speechModel?.properties || {};
    this.speaker = speaker || 'meera';
  }

  private async makeRequest(endpoint: string, payload: any) {
    const headers = new Headers({
      'api-subscription-key': this.apiKey!,
      'Content-Type': 'application/json',
    });
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let errorMessage;
      try {
        const error = (await response.json()) as { message?: string };
        errorMessage = error.message || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(`Sarvam AI API Error: ${errorMessage}`);
    }

    return response;
  }
  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: { speaker?: SarvamVoiceId },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    return this.traced(async () => {
      const payload = {
        inputs: [text],
        target_language_code: this.language,
        speaker: options?.speaker || this.speaker,
        model: this.model,
        ...this.properties,
      };

      const response = await this.makeRequest('/text-to-speech', payload);

      const { audios } = (await response.json()) as { audios: any };

      if (!audios || !audios.length) {
        throw new Error('No audio received from Sarvam AI');
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audios[0], 'base64');

      // Create a PassThrough stream for the audio
      const stream = new PassThrough();
      stream.write(audioBuffer);
      stream.end();

      return stream;
    }, 'voice.sarvam.speak')();
  }

  async getSpeakers() {
    return this.traced(async () => {
      return SARVAM_VOICES.map(voice => ({
        voiceId: voice,
      }));
    }, 'voice.deepgram.getSpeakers')();
  }

  //Todo: Implement the listen method
  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error('Listening method coming soon.');
  }
}
