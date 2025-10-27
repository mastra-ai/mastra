import { PassThrough } from 'stream';

import { SpeechClient } from '@google-cloud/speech';
import type { google as SpeechTypes } from '@google-cloud/speech/build/protos/protos';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { google as TextToSpeechTypes } from '@google-cloud/text-to-speech/build/protos/protos';
import { MastraVoice } from '@mastra/core/voice';

/**
 * Configuration for Google Cloud Voice models
 * @interface GoogleModelConfig
 * @property {string} [apiKey] - Optional Google Cloud API key. If not provided, will use GOOGLE_API_KEY environment variable
 * @property {string} [keyFilename] - Optional path to a service account key file. If not provided, will use GOOGLE_APPLICATION_CREDENTIALS environment variable
 * @property {{ client_email?: string; private_key?: string }} [credentials] - Optional in-memory service account credentials
 */
export interface GoogleModelConfig {
  apiKey?: string;
  keyFilename?: string;
  credentials?: {
    client_email?: string;
    private_key?: string;
    [key: string]: unknown;
  };
}

type AuthConfig = Pick<GoogleModelConfig, 'apiKey' | 'keyFilename' | 'credentials'>;

type GoogleClientOptions = AuthConfig;

const resolveAuthConfig = (modelConfig: GoogleModelConfig | undefined, fallback: AuthConfig): AuthConfig => {
  const resolved: AuthConfig = {};

  const apiKey = modelConfig?.apiKey ?? fallback.apiKey;
  if (apiKey) {
    resolved.apiKey = apiKey;
  }

  const keyFilename = modelConfig?.keyFilename ?? fallback.keyFilename;
  if (keyFilename) {
    resolved.keyFilename = keyFilename;
  }

  const credentials = modelConfig?.credentials ?? fallback.credentials;
  if (credentials) {
    resolved.credentials = credentials;
  }

  return resolved;
};

const buildAuthOptions = (config: AuthConfig): GoogleClientOptions => {
  if (config.credentials) {
    return { credentials: config.credentials };
  }

  if (config.keyFilename) {
    return { keyFilename: config.keyFilename };
  }

  if (config.apiKey) {
    return { apiKey: config.apiKey };
  }

  return {};
};

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
    const defaultKeyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const defaultSpeaker = DEFAULT_VOICE;

    const sharedFallback: AuthConfig = {
      apiKey: defaultApiKey ?? speechModel?.apiKey ?? listeningModel?.apiKey,
      keyFilename: defaultKeyFilename ?? speechModel?.keyFilename ?? listeningModel?.keyFilename,
      credentials: speechModel?.credentials ?? listeningModel?.credentials,
    };

    const speechAuthConfig = resolveAuthConfig(speechModel, sharedFallback);
    const listeningAuthConfig = resolveAuthConfig(listeningModel, sharedFallback);

    super({
      speechModel: {
        name: '',
        apiKey: speechAuthConfig.apiKey ?? defaultApiKey,
      },
      listeningModel: {
        name: '',
        apiKey: listeningAuthConfig.apiKey ?? defaultApiKey,
      },
      speaker: speaker ?? defaultSpeaker,
    });

    const ttsOptions = buildAuthOptions(speechAuthConfig);
    const speechOptions = buildAuthOptions(listeningAuthConfig);

    this.ttsClient = new TextToSpeechClient(ttsOptions);

    this.speechClient = new SpeechClient(speechOptions);
  }

  /**
   * Gets a list of available voices
   * @returns {Promise<Array<{voiceId: string, languageCodes: string[]}>>} List of available voices and their supported languages. Default language is en-US.
   */
  async getSpeakers({ languageCode = 'en-US' }: { languageCode?: string } = {}) {
    const [response] = await this.ttsClient.listVoices({ languageCode: languageCode });
    return (response?.voices || [])
      .filter(voice => voice.name && voice.languageCodes)
      .map(voice => ({
        voiceId: voice.name!,
        languageCodes: voice.languageCodes!,
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
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
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
    const [response] = await this.speechClient.recognize(request as SpeechTypes.cloud.speech.v1.IRecognizeRequest);

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
  }
}
