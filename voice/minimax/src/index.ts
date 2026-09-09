import { Readable } from 'node:stream';

import { MastraVoice } from '@internal/voice';

export const MINIMAX_TTS_ENDPOINTS = {
  global: 'https://api.minimax.io/v1/t2a_v2',
  china: 'https://api.minimaxi.com/v1/t2a_v2',
} as const;

export const MINIMAX_SPEECH_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo',
] as const;

export const MINIMAX_AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'pcm'] as const;

export type MiniMaxRegion = keyof typeof MINIMAX_TTS_ENDPOINTS;
export type MiniMaxSpeechModel = (typeof MINIMAX_SPEECH_MODELS)[number];
export type MiniMaxAudioFormat = (typeof MINIMAX_AUDIO_FORMATS)[number];

export interface MiniMaxVoiceSetting {
  voice_id: string;
  [key: string]: unknown;
}

export interface MiniMaxPronunciationDictionary {
  [key: string]: unknown;
}

export interface MiniMaxAudioSetting {
  format: MiniMaxAudioFormat;
  [key: string]: unknown;
}

export interface MiniMaxVoiceModify {
  [key: string]: unknown;
}

export interface MiniMaxSpeechRequest {
  model: MiniMaxSpeechModel;
  text: string;
  stream: boolean;
  language_boost?: string;
  output_format: 'hex';
  voice_setting: MiniMaxVoiceSetting;
  pronunciation_dict?: MiniMaxPronunciationDictionary;
  audio_setting: MiniMaxAudioSetting;
  voice_modify?: MiniMaxVoiceModify;
  subtitle_enable?: boolean;
}

export type MiniMaxSpeechProperties = Partial<
  Omit<MiniMaxSpeechRequest, 'model' | 'text' | 'output_format' | 'voice_setting' | 'audio_setting'>
> & {
  voice_setting?: Omit<MiniMaxVoiceSetting, 'voice_id'>;
  audio_setting?: Partial<MiniMaxAudioSetting>;
};

export interface MiniMaxConfig {
  name?: MiniMaxSpeechModel;
  apiKey?: string;
  region?: MiniMaxRegion;
  properties?: MiniMaxSpeechProperties;
}

export interface MiniMaxSpeakOptions {
  speaker?: string;
  model?: MiniMaxSpeechModel;
  properties?: MiniMaxSpeechProperties;
}

interface MiniMaxSpeechResponse {
  data?: {
    audio?: string;
    status?: number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export class MiniMaxVoice extends MastraVoice<unknown, MiniMaxSpeakOptions> {
  private readonly apiKey: string;
  private readonly endpoint: (typeof MINIMAX_TTS_ENDPOINTS)[MiniMaxRegion];
  private readonly properties: MiniMaxSpeechProperties;

  constructor({ speechModel, speaker }: { speechModel?: MiniMaxConfig; speaker?: string } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.MINIMAX_API_KEY;

    super({
      speechModel: {
        name: speechModel?.name ?? 'speech-2.8-hd',
        apiKey,
      },
      speaker,
    });

    if (!apiKey) {
      throw new Error('MINIMAX_API_KEY is not set');
    }

    this.apiKey = apiKey;
    this.endpoint = MINIMAX_TTS_ENDPOINTS[speechModel?.region ?? 'global'];
    this.properties = speechModel?.properties ?? { stream: false };
  }

  async speak(
    input: string | NodeJS.ReadableStream,
    options: MiniMaxSpeakOptions = {},
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);
    const speaker = options.speaker ?? this.speaker;

    if (!speaker) {
      throw new Error('A MiniMax speaker voice ID is required');
    }

    const properties = {
      ...this.properties,
      ...options.properties,
      voice_setting: {
        ...this.properties.voice_setting,
        ...options.properties?.voice_setting,
      },
      audio_setting: {
        ...this.properties.audio_setting,
        ...options.properties?.audio_setting,
      },
    };

    if (properties.stream) {
      throw new Error('MiniMax streaming responses are not supported by this voice integration');
    }

    const request: MiniMaxSpeechRequest = {
      model: options.model ?? (this.speechModel?.name as MiniMaxSpeechModel),
      text,
      stream: false,
      language_boost: properties.language_boost,
      output_format: 'hex',
      voice_setting: {
        ...properties.voice_setting,
        voice_id: speaker,
      },
      pronunciation_dict: properties.pronunciation_dict,
      audio_setting: {
        ...properties.audio_setting,
        format: properties.audio_setting.format ?? 'mp3',
      },
      voice_modify: properties.voice_modify,
      subtitle_enable: properties.subtitle_enable,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    const result = (await response.json()) as MiniMaxSpeechResponse;

    if (!response.ok || result.base_resp?.status_code !== 0) {
      const message = result.base_resp?.status_msg ?? `${response.status} ${response.statusText}`;
      throw new Error(`MiniMax TTS request failed: ${message}`);
    }

    if (result.data?.status !== 2) {
      throw new Error(`MiniMax TTS returned unexpected audio status: ${result.data?.status ?? 'missing'}`);
    }

    const audio = result.data.audio;
    if (!audio || audio.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(audio)) {
      throw new Error('MiniMax TTS returned invalid hex audio data');
    }

    return Readable.from([Buffer.from(audio, 'hex')]);
  }

  async getSpeakers() {
    return this.speaker ? [{ voiceId: this.speaker, name: this.speaker }] : [];
  }

  async getListener() {
    return { enabled: false };
  }

  async listen(_input: NodeJS.ReadableStream): Promise<string> {
    throw new Error('MiniMax voice integration does not support speech recognition');
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}
