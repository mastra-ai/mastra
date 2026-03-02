import { Readable } from 'node:stream';

import { MastraVoice } from '@mastra/core/voice';
import { HumeClient } from 'hume';

interface HumeVoiceConfig {
  apiKey?: string;
}

export class HumeVoice extends MastraVoice {
  private client: HumeClient;
  private storedSpeaker?: string;

  constructor({
    speechModel,
    speaker,
  }: {
    speechModel?: HumeVoiceConfig;
    speaker?: string;
  } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.HUME_API_KEY;

    super({
      speechModel: {
        name: 'hume',
        apiKey,
      },
      speaker,
    });

    if (!apiKey) {
      throw new Error('HUME_API_KEY is not set. Set it in environment variables or pass apiKey in speechModel config.');
    }

    this.client = new HumeClient({ apiKey });
    this.storedSpeaker = speaker;
  }

  /**
   * Retrieves a list of available voices from the Hume TTS API.
   * Includes both Hume Voice Library voices (HUME_AI) and custom voices (CUSTOM_VOICE).
   */
  async getSpeakers(): Promise<Array<{ voiceId: string; name?: string }>> {
    const voices: Array<{ voiceId: string; name?: string }> = [];

    try {
      for (const provider of ['HUME_AI', 'CUSTOM_VOICE'] as const) {
        const page = await this.client.tts.voices.list({ provider });
        const items = page.data ?? [];
        for (const voice of items) {
          const id = voice.id ?? voice.name;
          if (id) {
            voices.push({
              voiceId: id,
              name: voice.name,
            });
          }
        }
      }
    } catch {
      // Return empty if API fails (e.g. no custom voices)
      return [];
    }

    return voices;
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

  /**
   * Converts text to speech using Hume's TTS API.
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      format?: { type: 'mp3' | 'wav' | 'pcm' };
      description?: string;
      [key: string]: unknown;
    },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    if (text.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const speaker = options?.speaker ?? this.storedSpeaker;
    const voice = speaker ? { name: speaker } : undefined;

    const binaryBody = await this.client.tts.synthesizeFileStreaming({
      utterances: [{ text, voice, description: options?.description }],
      format: options?.format ?? { type: 'mp3' },
    });

    const webStream = binaryBody.stream();

    if (!webStream) {
      throw new Error('No stream returned from Hume TTS');
    }

    const nodeStream = Readable.fromWeb(webStream as globalThis.ReadableStream<Uint8Array>);

    return nodeStream;
  }

  /**
   * Checks if listening capabilities are enabled.
   */
  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }

  /**
   * Hume does not support speech-to-text. Use CompositeVoice with another provider for STT.
   */
  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error(
      'Hume does not support speech recognition. Use CompositeVoice with a provider like Deepgram for STT.',
    );
  }
}

export type { HumeVoiceConfig };
