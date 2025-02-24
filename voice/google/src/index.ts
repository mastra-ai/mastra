import { SpeechClient } from '@google-cloud/speech';
import type { google as SpeechTypes } from '@google-cloud/speech/build/protos/protos';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { google as TextToSpeechTypes } from '@google-cloud/text-to-speech/build/protos/protos';
import { MastraVoice } from '@mastra/core/voice';
import { PassThrough } from 'stream';

/**
 * Configuration for Google Cloud Voice models
 * @interface GoogleModelConfig
 * @property {string} [apiKey] - Optional Google Cloud API key. If not provided, will use GOOGLE_API_KEY environment variable
 */
export interface GoogleModelConfig {
  apiKey?: string;
}

const DEFAULT_VOICE = 'en-US-Casual-K';

/**
 * GoogleVoice class provides Text-to-Speech and Speech-to-Text capabilities using Google Cloud services
 * @class GoogleVoice
 * @extends MastraVoice
 */
export class GoogleVoice extends MastraVoice {
  private ttsClient: TextToSpeechClient;
  private speechClient: SpeechClient;

  /**
   * Creates an instance of GoogleVoice
   * @param {Object} config - Configuration options
   * @param {GoogleModelConfig} [config.speechModel] - Configuration for speech synthesis
   * @param {GoogleModelConfig} [config.listeningModel] - Configuration for speech recognition
   * @param {string} [config.speaker] - Default voice ID to use for speech synthesis
   * @throws {Error} If no API key is provided via config or environment variable
   */
  constructor({
    listeningModel,
    speechModel,
    speaker,
  }: {
    listeningModel?: GoogleModelConfig;
    speechModel?: GoogleModelConfig;
    speaker?: string;
  } = {}) {
    const defaultApiKey = process.env.GOOGLE_API_KEY;
    const defaultSpeaker = DEFAULT_VOICE;

    super({
      speechModel: {
        name: '',
        apiKey: speechModel?.apiKey ?? defaultApiKey,
      },
      listeningModel: {
        name: '',
        apiKey: listeningModel?.apiKey ?? defaultApiKey,
      },
      speaker: speaker ?? defaultSpeaker,
    });

    const apiKey = defaultApiKey || speechModel?.apiKey || listeningModel?.apiKey;
    if (!apiKey) {
      throw new Error(
        'Google API key is not set, set GOOGLE_API_KEY environment variable or pass apiKey to constructor',
      );
    }

    this.ttsClient = new TextToSpeechClient({
      apiKey: this.speechModel?.apiKey || defaultApiKey,
    });

    this.speechClient = new SpeechClient({
      apiKey: this.listeningModel?.apiKey || defaultApiKey,
    });
  }

  /**
   * Gets a list of available voices
   * @returns {Promise<Array<{voiceId: string, languageCodes: string[]}>>} List of available voices and their supported languages. Default language is en-US.
   */
  async getSpeakers({ languageCode = 'en-US' }: { languageCode?: string } = {}) {
    return this.traced(async () => {
      const [response] = await this.ttsClient.listVoices({ languageCode: languageCode });
      return (response?.voices || [])
        .filter(voice => voice.name && voice.languageCodes)
        .map(voice => ({
          voiceId: voice.name!,
          languageCodes: voice.languageCodes!,
        }));
    }, 'voice.google.getSpeakers')();
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  /**
   * Converts text to speech
   * @param {string | NodeJS.ReadableStream} input - Text or stream to convert to speech
   * @param {Object} [options] - Speech synthesis options
   * @param {string} [options.speaker] - Voice ID to use
   * @param {string} [options.languageCode] - Language code for the voice
   * @param {TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest['audioConfig']} [options.audioConfig] - Audio configuration options
   * @returns {Promise<NodeJS.ReadableStream>} Stream of synthesized audio. Default encoding is LINEAR16.
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      languageCode?: string;
      audioConfig?: TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest['audioConfig'];
    },
  ): Promise<NodeJS.ReadableStream> {
    return this.traced(async () => {
      const text = typeof input === 'string' ? input : await this.streamToString(input);

      const request: TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: {
          name: options?.speaker || this.speaker,
          languageCode: options?.languageCode || options?.speaker?.split('-').slice(0, 2).join('-') || 'en-US',
        },
        audioConfig: options?.audioConfig || { audioEncoding: 'LINEAR16' },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned.');
      }

      if (typeof response.audioContent === 'string') {
        throw new Error('Audio content is a string.');
      }

      const stream = new PassThrough();
      stream.end(Buffer.from(response.audioContent));
      return stream;
    }, 'voice.google.speak')();
  }

  /**
   * Converts speech to text
   * @param {NodeJS.ReadableStream} audioStream - Audio stream to transcribe. Default encoding is LINEAR16.
   * @param {Object} [options] - Recognition options
   * @param {SpeechTypes.cloud.speech.v1.IRecognitionConfig} [options.config] - Recognition configuration
   * @returns {Promise<string>} Transcribed text
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: { stream?: boolean; config?: SpeechTypes.cloud.speech.v1.IRecognitionConfig },
  ): Promise<string> {
    return this.traced(async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      let request = {
        config: {
          encoding: 'LINEAR16',
          languageCode: 'en-US',
          ...options?.config,
        },
        audio: {
          content: buffer.toString('base64'),
        },
      };
      console.log(`BEFORE REQUEST`);
      const [response] = await this.speechClient.recognize(request as SpeechTypes.cloud.speech.v1.IRecognizeRequest);
      console.log(`AFTER REQUEST`);

      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results returned');
      }

      const transcription = response.results
        .map((result: any) => {
          if (!result.alternatives || result.alternatives.length === 0) {
            return '';
          }
          return result.alternatives[0].transcript || '';
        })
        .filter((text: string) => text.length > 0)
        .join(' ');

      if (!transcription) {
        throw new Error('No valid transcription found in results');
      }

      return transcription;
    }, 'voice.google.listen')();
  }
}
