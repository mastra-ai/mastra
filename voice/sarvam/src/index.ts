import { PassThrough } from 'node:stream';

import { MastraVoice } from '@mastra/core/voice';
import { SARVAM_VOICES } from './voices';
import type {
  SarvamTTSLanguage,
  SarvamSTTLanguage,
  SarvamSTTModel,
  SarvamTTSModel,
  SarvamVoiceId,
  SarvamSTTMode,
} from './voices';

interface SarvamVoiceConfig {
  apiKey?: string;
  model?: SarvamTTSModel;
  language?: SarvamTTSLanguage;
  properties?: {
    /** Controls the speed of the audio. Supported by bulbul:v2 (0.3–3.0) and bulbul:v3 (0.5–2.0). */
    pace?: number;
    /** Sampling temperature. bulbul:v3 only. Range: 0.01–2.0. Default: 0.6. */
    temperature?: number;
    /** Pronunciation dictionary ID. bulbul:v3 only. */
    dict_id?: string;
    /** Controls the pitch of the audio. bulbul:v2 only. Range: -0.75–0.75. */
    pitch?: number;
    /** Controls the loudness of the audio. bulbul:v2 only. Range: 0.3–3.0. */
    loudness?: number;
    /** Enables normalization of English words and numeric entities. bulbul:v2 only. */
    enable_preprocessing?: boolean;
    /** Audio sample rate in Hz. */
    speech_sample_rate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
    /** Output audio codec. */
    output_audio_codec?: 'mp3' | 'wav' | 'linear16' | 'mulaw' | 'alaw' | 'opus' | 'flac' | 'aac';
  };
}

interface SarvamListenOptions {
  apiKey?: string;
  model?: SarvamSTTModel;
  languageCode?: SarvamSTTLanguage;
  filetype?: 'mp3' | 'wav';
  /** Operation mode for saaras:v3. Ignored by other models. */
  mode?: SarvamSTTMode;
}

const defaultSpeechModel = {
  model: 'bulbul:v3' as const,
  apiKey: process.env.SARVAM_API_KEY,
  language: 'en-IN' as const,
};

const defaultListeningModel = {
  model: 'saarika:v2.5' as const,
  apiKey: process.env.SARVAM_API_KEY,
  language_code: 'unknown' as const,
};

export class SarvamVoice extends MastraVoice {
  private apiKey?: string;
  private model: SarvamTTSModel = 'bulbul:v3';
  private language: SarvamTTSLanguage = 'en-IN';
  private properties: Record<string, any> = {};
  speaker: SarvamVoiceId = 'shubh';
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
        apiKey: listeningModel?.apiKey ?? defaultListeningModel.apiKey,
      },
      speaker,
    });

    this.apiKey = speechModel?.apiKey || listeningModel?.apiKey || defaultSpeechModel.apiKey;
    if (!this.apiKey) {
      throw new Error('SARVAM_API_KEY must be set');
    }
    this.model = speechModel?.model || defaultSpeechModel.model;
    this.language = speechModel?.language || defaultSpeechModel.language;
    this.properties = speechModel?.properties || {};
    // bulbul:v2 and bulbul:v3 have non-overlapping speaker catalogs, so the
    // default speaker depends on the selected TTS model.
    const defaultSpeaker: SarvamVoiceId = this.model === 'bulbul:v2' ? 'anushka' : 'shubh';
    this.speaker = speaker || defaultSpeaker;
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

    const payload = {
      text,
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
  }

  async getSpeakers() {
    return SARVAM_VOICES.map(voice => ({
      voiceId: voice,
    }));
  }

  /**
   * Checks if listening capabilities are enabled.
   *
   * @returns {Promise<{ enabled: boolean }>}
   */
  async getListener() {
    return { enabled: true };
  }

  async listen(input: NodeJS.ReadableStream, options?: SarvamListenOptions): Promise<string> {
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
    form.append('model', options?.model || 'saarika:v2.5');
    form.append('language_code', options?.languageCode || 'unknown');
    // `mode` is only meaningful for saaras:v3 — Sarvam ignores it for saarika models.
    if (options?.mode) {
      form.append('mode', options.mode);
    }
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
      return result.transcript;
    } catch (error) {
      console.error('Error during speech-to-text request:', error);
      throw error;
    }
  }
}
