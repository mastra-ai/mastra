import { createClient } from '@deepgram/sdk';
import { MastraVoice } from '@mastra/core/voice';
import { PassThrough } from 'stream';

import { DEEPGRAM_VOICES } from './voices';
import type { DeepgramVoiceId, DeepgramModel } from './voices';

interface DeepgramVoiceConfig {
  name?: DeepgramModel;
  apiKey?: string;
  properties?: Record<string, any>;
  language?: string;
}

export class DeepgramVoice extends MastraVoice {
  private speechClient?: ReturnType<typeof createClient>;
  private listeningClient?: ReturnType<typeof createClient>;

  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: { speechModel?: DeepgramVoiceConfig; listeningModel?: DeepgramVoiceConfig; speaker?: DeepgramVoiceId } = {}) {
    const defaultApiKey = process.env.DEEPGRAM_API_KEY;

    const defaultSpeechModel = {
      name: 'aura',
      apiKey: defaultApiKey,
    };

    const defaultListeningModel = {
      name: 'nova',
      apiKey: defaultApiKey,
    };

    super({
      speechModel: {
        name: speechModel?.name ?? defaultSpeechModel.name,
        apiKey: speechModel?.apiKey ?? defaultSpeechModel.apiKey,
      },
      listeningModel: {
        name: listeningModel?.name ?? defaultListeningModel.name,
        apiKey: listeningModel?.apiKey ?? defaultListeningModel.apiKey,
      },
      speaker,
    });

    const speechApiKey = speechModel?.apiKey || defaultApiKey;
    const listeningApiKey = listeningModel?.apiKey || defaultApiKey;

    if (!speechApiKey && !listeningApiKey) {
      throw new Error('At least one of DEEPGRAM_API_KEY, speechModel.apiKey, or listeningModel.apiKey must be set');
    }

    if (speechApiKey) {
      this.speechClient = createClient(speechApiKey);
    }
    if (listeningApiKey) {
      this.listeningClient = createClient(listeningApiKey);
    }

    this.speaker = speaker || 'asteria-en';
  }

  async getSpeakers() {
    return this.traced(async () => {
      return DEEPGRAM_VOICES.map(voice => ({
        voiceId: voice,
      }));
    }, 'voice.deepgram.getSpeakers')();
  }

  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      [key: string]: any;
    },
  ): Promise<NodeJS.ReadableStream> {
    if (!this.speechClient) {
      throw new Error('Deepgram speech client not configured');
    }

    let text: string;
    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.from(chunk));
      }
      text = Buffer.concat(chunks).toString('utf-8');
    } else {
      text = input;
    }

    if (text.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    return this.traced(async () => {
      if (!this.speechClient) {
        throw new Error('No speech client configured');
      }

      let model;
      if (options?.speaker) {
        model = this.speechModel?.name + '-' + options.speaker;
      } else if (this.speaker) {
        model = this.speechModel?.name + '-' + this.speaker;
      }

      const speakClient = this.speechClient.speak;
      const response = await speakClient.request(
        { text },
        {
          model,
          ...options,
        },
      );

      const webStream = await response.getStream();
      if (!webStream) {
        throw new Error('No stream returned from Deepgram');
      }

      const reader = webStream.getReader();
      const nodeStream = new PassThrough();

      // Add error handling for the stream processing
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              nodeStream.end();
              break;
            }
            nodeStream.write(value);
          }
        } catch (error) {
          nodeStream.destroy(error as Error);
        }
      })().catch(error => {
        nodeStream.destroy(error as Error);
      });

      return nodeStream;
    }, 'voice.deepgram.speak')();
  }

  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: {
      [key: string]: any;
    },
  ): Promise<string> {
    if (!this.listeningClient) {
      throw new Error('Deepgram listening client not configured');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return this.traced(async () => {
      if (!this.listeningClient) {
        throw new Error('No listening client configured');
      }
      const { result, error } = await this.listeningClient.listen.prerecorded.transcribeFile(buffer, {
        model: this.listeningModel?.name,
        ...options,
      });

      if (error) {
        throw error;
      }

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      if (!transcript) {
        throw new Error('No transcript found in Deepgram response');
      }

      return transcript;
    }, 'voice.deepgram.listen')();
  }
}

export type { DeepgramVoiceConfig, DeepgramVoiceId, DeepgramModel };
