import { MastraVoice } from '@mastra/core/voice';
import ky from 'ky';
import { PassThrough } from 'stream';

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

export class MurfVoice extends MastraVoice {
  private client: typeof ky;
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

    this.properties = {
      ...speechModel?.properties,
    };

    this.client = ky.create({
      prefixUrl: 'https://api.murf.ai',
      headers: {
        'api-key': apiKey,
      },
    });

    this.defaultVoice = (speaker as MurfVoiceId) ?? MURF_VOICES[0];
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
    options?: { speaker?: string; properties?: Omit<SpeechCreateParams, 'modelVersion' | 'voiceId' | 'text'> },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    return this.traced(async () => {
      const response = await this.client
        .post('v1/speech/generate', {
          json: {
            voiceId: (options?.speaker || this.defaultVoice) as MurfVoiceId,
            text,
            modelVersion: this.speechModel?.name,
            ...this.properties,
            ...options?.properties,
          },
        })
        .json<SpeechCreateResponse>();

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
    }, 'voice.murf.speak')();
  }

  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error('Murf does not support speech recognition');
  }

  async getSpeakers() {
    return this.traced(async () => {
      return MURF_VOICES.map(voice => ({
        voiceId: voice,
        name: voice,
        language: voice.split('-')[0],
        gender: 'neutral',
      }));
    }, 'voice.murf.getSpeakers')();
  }
}

export type { MurfConfig, MurfVoiceId };
