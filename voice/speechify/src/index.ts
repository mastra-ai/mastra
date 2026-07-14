import { Readable } from 'node:stream';

import { MastraVoice } from '@internal/voice';
import { Speechify } from '@speechify/api-sdk';
import type { AudioStreamRequest, VoiceModelName } from '@speechify/api-sdk';

import { SPEECHIFY_VOICES } from './voices';
import type { SpeechifyVoiceId } from './voices';

/**
 * Models accepted by the Speechify API. Extends the SDK's `VoiceModelName`
 * with the Simba 3 generation models, which the API accepts but the SDK's
 * type union does not yet include. `simba-3.0` and `simba-3.2` are
 * currently English only.
 */
type SpeechifyModel = VoiceModelName | 'simba-3.0' | 'simba-3.2';

interface SpeechifyConfig {
  name?: SpeechifyModel;
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
    return SPEECHIFY_VOICES.map(voice => ({
      voiceId: voice,
      name: voice,
    }));
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
    options?: {
      speaker?: string;
      model?: SpeechifyModel;
    } & Omit<AudioStreamRequest, 'voiceId' | 'input' | 'model'>,
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    const { speaker, model, ...streamOptions } = options ?? {};
    const request: AudioStreamRequest = {
      ...streamOptions,
      input: text,
      // The SDK sends `model` to the API verbatim, so casting the wider
      // SpeechifyModel union into its narrower VoiceModelName is safe.
      model: (model || this.speechModel?.name) as VoiceModelName,
      voiceId: (speaker || this.speaker) as SpeechifyVoiceId,
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
    throw new Error('Speechify does not support speech recognition');
  }
}

export type { SpeechifyConfig, SpeechifyModel, SpeechifyVoiceId };
