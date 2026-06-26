import { PassThrough } from 'node:stream';
import { MastraVoice } from '@internal/voice';
import { MURF_VOICES } from './voices';
import type { MurfVoiceId } from './voices';

type MurfConfig = {
  name: 'GEN1' | 'GEN2';
  apiKey?: string;
  properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;
};

type SpeechCreateParams = {
  voiceId: MurfVoiceId;
  text: string;
  modelVersion: 'GEN1' | 'GEN2';
  style?: string;
  rate?: number;
  pitch?: number;
  sampleRate?: 8000 | 24000 | 44100 | 48000;
  format?: 'MP3' | 'WAV' | 'FLAC' | 'ALAW' | 'ULAW';
  channelType?: 'STEREO' | 'MONO';
  pronunciationDictionary?: Record<string, string>;
  encodeAsBase64?: boolean;
  variation?: number;
  audioDuration?: number;
  multiNativeLocale?: string;
};

type SpeechCreateResponse = {
  audioFile: string;
  audioLengthInSeconds: number;
  consumedCharacterCount: number;
  encodedAudio: string;
  remainingCharacterCount: number;
  warning: string;
  wordDurations: {
    endMs: number;
    pitchScaleMaximum: number;
    pitchScaleMinimum: number;
    sourceWordIndex: number;
    startMs: number;
    word: string;
  }[];
};

const DEFAULT_RETRY_COUNT = 2;
const RETRY_STATUS_CODES = new Set([408, 413, 429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 300;

export class MurfVoice extends MastraVoice {
  private baseUrl = 'https://api.murf.ai';
  private apiKey: string;
  private defaultVoice: MurfVoiceId;
  private properties: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'>;

  constructor({ speechModel, speaker }: { speechModel?: MurfConfig; speaker?: string } = {}) {
    super({
      speechModel: {
        name: speechModel?.name ?? 'GEN2',
        apiKey: speechModel?.apiKey ?? process.env.MURF_API_KEY,
      },
      speaker: speaker ?? MURF_VOICES[0],
    });

    const apiKey = this.speechModel?.apiKey;
    if (!apiKey) {
      throw new Error('MURF_API_KEY is not set');
    }

    this.apiKey = apiKey;

    this.properties = {
      ...speechModel?.properties,
    };

    this.defaultVoice = (speaker as MurfVoiceId) ?? MURF_VOICES[0];
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
    options?: { speaker?: string; properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'> },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    const response = await this.makeRequest<SpeechCreateResponse>('/v1/speech/generate', {
      voiceId: (options?.speaker || this.defaultVoice) as MurfVoiceId,
      text,
      modelVersion: this.speechModel?.name,
      ...this.properties,
      ...options?.properties,
    });

    // Create a PassThrough stream for the audio
    const stream = new PassThrough();

    // Get the audio file as a stream
    const audioResponse = await fetch(response.audioFile);
    if (!audioResponse.body) {
      throw new Error('No response body received');
    }

    // Process the stream
    const reader = audioResponse.body.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            stream.end();
            break;
          }
          stream.write(value);
        }
      } catch (error) {
        stream.destroy(error as Error);
      }
    })().catch(error => {
      stream.destroy(error as Error);
    });

    return stream;
  }

  /**
   * Checks if listening capabilities are enabled.
   *
   * @returns {Promise<{ enabled: boolean }>}
   */
  async getListener() {
    return { enabled: false };
  }

  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error('Murf does not support speech recognition');
  }

  private async makeRequest<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= DEFAULT_RETRY_COUNT; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * 2 ** (attempt - 1)));
      }

      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return (await res.json()) as T;
      }

      if (!RETRY_STATUS_CODES.has(res.status) || attempt === DEFAULT_RETRY_COUNT) {
        let errorMessage: string;
        try {
          const error = (await res.json()) as { message?: string };
          errorMessage = error.message || res.statusText;
        } catch {
          errorMessage = res.statusText;
        }
        throw new Error(`Murf API Error: ${errorMessage}`);
      }

      lastError = new Error(`Murf API Error: ${res.statusText}`);
    }

    throw lastError ?? new Error('Murf API Error: request failed');
  }

  async getSpeakers() {
    return MURF_VOICES.map(voice => ({
      voiceId: voice,
      name: voice,
      language: voice.split('-')[0],
      gender: 'neutral',
    }));
  }
}

export type { MurfConfig, MurfVoiceId };
