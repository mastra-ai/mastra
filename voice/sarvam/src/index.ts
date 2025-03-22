import { PassThrough } from 'stream';

import { MastraVoice } from '@mastra/core/voice';
import { SARVAM_VOICES } from './voices';
import type { SarvamTTSLanguage, SarvamSTTLanguage, SarvamSTTModel, SarvamTTSModel, SarvamVoiceId } from './voices';

interface SarvamVoiceConfig {
  apiKey?: string;
  model?: SarvamTTSModel;
  language?: SarvamTTSLanguage;
  properties?: {
    pitch?: number;
    pace?: number;
    loudness?: number;
    speech_sample_rate?: 8000 | 16000 | 22050;
    enable_preprocessing?: boolean;
    eng_interpolation_wt?: number;
  };
}

interface SarvamListenOptions {
  apiKey?: string;
  model?: SarvamSTTModel;
  languageCode?: SarvamSTTLanguage;
  filetype?: 'mp3' | 'wav';
}

const defaultSpeechModel = {
  model: 'bulbul:v1' as const,
  apiKey: process.env.SARVAM_API_KEY,
  language: 'en-IN' as const,
};

const defaultListeningModel = {
  model: 'saarika:v2' as const,
  apiKey: process.env.SARVAM_API_KEY,
  language_code: 'unknown' as const,
};

export class SarvamVoice extends MastraVoice {
  private apiKey?: string;
  private model: SarvamTTSModel = 'bulbul:v1';
  private language: SarvamTTSLanguage = 'en-IN';
  private properties: Record<string, any> = {};
  protected speaker: SarvamVoiceId = 'meera';
  private baseUrl = 'https://api.sarvam.ai';

  constructor({
    speechModel,
    speaker,
    listeningModel,
  }: {
    speechModel?: SarvamVoiceConfig;
    speaker?: SarvamVoiceId;
    listeningModel?: SarvamListenOptions;
  } = {}) {
    super({
      speechModel: {
        name: speechModel?.model ?? defaultSpeechModel.model,
        apiKey: speechModel?.apiKey ?? defaultSpeechModel.apiKey,
      },
      listeningModel: {
        name: listeningModel?.model ?? defaultListeningModel.model,
        apiKey: listeningModel?.model ?? defaultListeningModel.apiKey,
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

  async listen(input: NodeJS.ReadableStream, options?: SarvamListenOptions): Promise<string> {
    return this.traced(async () => {
      // Collect audio data into buffer
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      const audioBuffer = Buffer.concat(chunks);

      const form = new FormData();
      const mimeType = options?.filetype === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      const blob = new Blob([audioBuffer], { type: mimeType });

      form.append('file', blob);
      form.append('model', options?.model || 'saarika:v2');
      form.append('language_code', options?.languageCode || 'unknown');
      const requestOptions = {
        method: 'POST',
        headers: {
          'api-subscription-key': this.apiKey!,
        },
        body: form,
      };

      try {
        const response = await fetch(`${this.baseUrl}/speech-to-text`, requestOptions);
        const result = (await response.json()) as any;
        //console.log(result);
        return result.transcript;
      } catch (error) {
        console.error('Error during speech-to-text request:', error);
        throw error;
      }
    }, 'voice.sarvam.listen')();
  }
}
