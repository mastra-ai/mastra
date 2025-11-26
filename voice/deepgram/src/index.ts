import { PassThrough } from 'stream';

import { createClient } from '@deepgram/sdk';
import { MastraVoice } from '@mastra/core/voice';

import { DEEPGRAM_VOICES } from './voices';
import type { DeepgramVoiceId, DeepgramModel } from './voices';

interface DeepgramVoiceConfig {
  name?: DeepgramModel;
  apiKey?: string;
  properties?: Record<string, any>;
  language?: string;
}

interface DeepgramWord {
  word: string;
  start?: number;
  end?: number;
  confidence?: number;
  speaker?: number;
}

export class DeepgramVoice extends MastraVoice {
  private speechClient?: ReturnType<typeof createClient>;
  private listeningClient?: ReturnType<typeof createClient>;
  private storedSpeechModel?: { name: DeepgramModel; apiKey?: string };
  private storedListeningModel?: { name: DeepgramModel; apiKey?: string };
  private storedSpeaker?: DeepgramVoiceId;

  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: { speechModel?: DeepgramVoiceConfig; listeningModel?: DeepgramVoiceConfig; speaker?: DeepgramVoiceId } = {}) {
    const defaultApiKey = process.env.DEEPGRAM_API_KEY;

    const defaultSpeechModel: { name: DeepgramModel; apiKey?: string } = {
      name: 'aura',
      apiKey: defaultApiKey,
    };

    const defaultListeningModel: { name: DeepgramModel; apiKey?: string } = {
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

    this.storedSpeechModel = {
      name: speechModel?.name ?? defaultSpeechModel.name,
      apiKey: speechModel?.apiKey ?? defaultSpeechModel.apiKey,
    };
    this.storedListeningModel = {
      name: listeningModel?.name ?? defaultListeningModel.name,
      apiKey: listeningModel?.apiKey ?? defaultListeningModel.apiKey,
    };

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

    this.storedSpeaker = speaker || 'asteria-en';
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
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
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

      const baseModel = this.storedSpeechModel?.name;
      const speakerId = options?.speaker || this.storedSpeaker;

      const modelName =
        baseModel && speakerId
          ? speakerId.startsWith(`${baseModel}-`)
            ? speakerId
            : `${baseModel}-${speakerId}`
          : baseModel || speakerId;

      const speakClient = this.speechClient.speak;
      const response = await speakClient.request(
        { text },
        {
          model: modelName,
          ...Object.fromEntries(Object.entries(options ?? {}).filter(([k]) => k !== 'speaker')),
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

  /**
   * Checks if listening capabilities are enabled.
   *
   * @returns {Promise<{ enabled: boolean }>}
   */
  async getListener() {
    return { enabled: true };
  }

  /**
   * Transcribes audio with optional speaker diarization.
   *
   * @param audioStream - Audio input stream
   * @param options - Transcription options (diarize, language, etc.)
   * @returns Promise resolving to:
   *   - transcript: Full transcript string
   *   - words: Array of word objects with timing and confidence
   *   - raw: Complete Deepgram API response
   *   - speakerSegments: (when diarize=true) Array of {word, speaker, start, end}
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: {
      diarize?: boolean;
      [key: string]: any;
    },
  ): Promise<any> {
    if (!this.listeningClient) {
      throw new Error('Deepgram listening client not configured');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    const buffer = Buffer.concat(chunks);

    return this.traced(async () => {
      if (!this.listeningClient) {
        throw new Error('No listening client configured');
      }

      const { diarize, diarize_speaker_count: _, ...restOptions } = options ?? {};
      const { result, error } = await this.listeningClient.listen.prerecorded.transcribeFile(buffer, {
        ...restOptions,
        model: this.storedListeningModel?.name,
        diarize,
      });

      if (error) {
        throw error;
      }

      const channel = result.results?.channels?.[0];
      const alt:
        | {
            transcript?: string;
            words?: DeepgramWord[];
          }
        | undefined = channel?.alternatives?.[0];

      if (!alt) {
        return {
          transcript: '',
          words: [],
          raw: result,
        };
      }

      const response: any = {
        transcript: alt.transcript,
        words: alt.words,
        raw: result,
      };

      if (diarize && alt.words) {
        response.speakerSegments = alt.words.map((w: DeepgramWord) => ({
          word: w.word,
          speaker: w.speaker,
          start: w.start,
          end: w.end,
        }));
      }

      return response;
    }, 'voice.deepgram.listen')();
  }
}

export type { DeepgramVoiceConfig, DeepgramVoiceId, DeepgramModel };
