import { PassThrough } from 'stream';

import { MastraVoice } from '@mastra/core/voice';
import OpenAI from 'openai';

type OpenAIVoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'ash' | 'coral' | 'sage';
type OpenAIModel = 'tts-1' | 'tts-1-hd' | 'whisper-1';

export interface OpenAIConfig {
  name?: OpenAIModel;
  apiKey?: string;
}

export interface OpenAIVoiceConfig {
  speech?: {
    model: 'tts-1' | 'tts-1-hd';
    apiKey?: string;
    speaker?: OpenAIVoiceId;
  };
  listening?: {
    model: 'whisper-1';
    apiKey?: string;
  };
}

export class OpenAIVoice extends MastraVoice {
  speechClient?: OpenAI;
  listeningClient?: OpenAI;

  /**
   * Constructs an instance of OpenAIVoice with optional configurations for speech and listening models.
   *
   * @param {Object} [config] - Configuration options for the OpenAIVoice instance.
   * @param {OpenAIConfig} [config.listeningModel] - Configuration for the listening model, including model name and API key.
   * @param {OpenAIConfig} [config.speechModel] - Configuration for the speech model, including model name and API key.
   * @param {string} [config.speaker] - The default speaker's voice to use for speech synthesis.
   * @throws {Error} - Throws an error if no API key is provided for either the speech or listening model.
   */
  constructor({
    listeningModel,
    speechModel,
    speaker,
  }: {
    listeningModel?: OpenAIConfig;
    speechModel?: OpenAIConfig;
    speaker?: string;
  } = {}) {
    const defaultApiKey = process.env.OPENAI_API_KEY;
    const defaultSpeechModel = {
      name: 'tts-1',
      apiKey: defaultApiKey,
    };
    const defaultListeningModel = {
      name: 'whisper-1',
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
      speaker: speaker ?? 'alloy',
    });

    const speechApiKey = speechModel?.apiKey || defaultApiKey;
    if (!speechApiKey) {
      throw new Error('No API key provided for speech model');
    }
    this.speechClient = new OpenAI({ apiKey: speechApiKey });

    const listeningApiKey = listeningModel?.apiKey || defaultApiKey;
    if (!listeningApiKey) {
      throw new Error('No API key provided for listening model');
    }
    this.listeningClient = new OpenAI({ apiKey: listeningApiKey });

    if (!this.speechClient && !this.listeningClient) {
      throw new Error('At least one of OPENAI_API_KEY, speechModel.apiKey, or listeningModel.apiKey must be set');
    }
  }

  /**
   * Retrieves a list of available speakers for the speech model.
   *
   * @returns {Promise<Array<{ voiceId: OpenAIVoiceId }>>} - A promise that resolves to an array of objects,
   * each containing a `voiceId` representing an available speaker.
   * @throws {Error} - Throws an error if the speech model is not configured.
   */
  async getSpeakers(): Promise<Array<{ voiceId: OpenAIVoiceId }>> {
    if (!this.speechModel) {
      throw new Error('Speech model not configured');
    }

    return [
      { voiceId: 'alloy' },
      { voiceId: 'echo' },
      { voiceId: 'fable' },
      { voiceId: 'onyx' },
      { voiceId: 'nova' },
      { voiceId: 'shimmer' },
      { voiceId: 'ash' },
      { voiceId: 'coral' },
      { voiceId: 'sage' },
    ];
  }

  /**
   * Converts text or audio input into speech using the configured speech model.
   *
   * @param {string | NodeJS.ReadableStream} input - The text or audio stream to be converted into speech.
   * @param {Object} [options] - Optional parameters for the speech synthesis.
   * @param {string} [options.speaker] - The speaker's voice to use for the speech synthesis.
   * @param {number} [options.speed] - The speed at which the speech should be synthesized.
   * @returns {Promise<NodeJS.ReadableStream>} - A promise that resolves to a readable stream of the synthesized audio.
   * @throws {Error} - Throws an error if the speech model is not configured or if the input text is empty.
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      speed?: number;
      [key: string]: any;
    },
  ): Promise<NodeJS.ReadableStream> {
    if (!this.speechClient) {
      throw new Error('Speech model not configured');
    }

    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      input = Buffer.concat(chunks).toString('utf-8');
    }

    if (input.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const audio = await this.traced(async () => {
      const response = await this.speechClient!.audio.speech.create({
        model: this.speechModel?.name ?? 'tts-1',
        voice: (options?.speaker ?? this.speaker) as OpenAIVoiceId,
        response_format: options?.responseFormat ?? 'mp3',
        input,
        speed: options?.speed || 1.0,
      });

      const passThrough = new PassThrough();
      const buffer = Buffer.from(await response.arrayBuffer());
      passThrough.end(buffer);
      return passThrough;
    }, 'voice.openai.speak')();

    return audio;
  }

  /**
   * Transcribes audio from a given stream using the configured listening model.
   *
   * @param {NodeJS.ReadableStream} audioStream - The audio stream to be transcribed.
   * @param {Object} [options] - Optional parameters for the transcription.
   * @param {string} [options.filetype] - The file type of the audio stream.
   *                                      Supported types include 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'.
   * @returns {Promise<string>} - A promise that resolves to the transcribed text.
   * @throws {Error} - Throws an error if the listening model is not configured.
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: {
      filetype?: 'mp3' | 'mp4' | 'mpeg' | 'mpga' | 'm4a' | 'wav' | 'webm';
      [key: string]: any;
    },
  ): Promise<string> {
    if (!this.listeningClient) {
      throw new Error('Listening model not configured');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    const audioBuffer = Buffer.concat(chunks);

    const text = await this.traced(async () => {
      const { filetype, ...otherOptions } = options || {};
      const file = new File([audioBuffer], `audio.${filetype || 'mp3'}`);

      const response = await this.listeningClient!.audio.transcriptions.create({
        model: this.listeningModel?.name || 'whisper-1',
        file: file as any,
        ...otherOptions,
      });

      return response.text;
    }, 'voice.openai.listen')();

    return text;
  }
}
