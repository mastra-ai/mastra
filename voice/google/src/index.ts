import { PassThrough } from 'node:stream';

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

/**
 * Configuration options for GoogleVoice
 * @interface GoogleVoiceConfig
 */
export interface GoogleVoiceConfig {
  /** Configuration for speech synthesis (TTS) */
  speechModel?: GoogleModelConfig;
  /** Configuration for speech recognition (STT) */
  listeningModel?: GoogleModelConfig;
  /** Default voice ID to use for speech synthesis */
  speaker?: string;
  /**
   * Enable Vertex AI mode for enterprise deployments.
   * When true, uses Google Cloud project-based authentication instead of API keys.
   * Requires `project` to be set or GOOGLE_CLOUD_PROJECT environment variable.
   */
  vertexAI?: boolean;
  /**
   * Google Cloud project ID (required when vertexAI is true).
   * Falls back to GOOGLE_CLOUD_PROJECT environment variable.
   */
  project?: string;
  /**
   * Google Cloud region for Vertex AI endpoints.
   * Falls back to GOOGLE_CLOUD_LOCATION environment variable.
   * @default 'us-central1'
   */
  location?: string;
}

type AuthConfig = Pick<GoogleModelConfig, 'apiKey' | 'keyFilename' | 'credentials'> & {
  projectId?: string;
};

type GoogleClientOptions = AuthConfig;

const resolveAuthConfig = (
  modelConfig: GoogleModelConfig | undefined,
  fallback: AuthConfig,
  vertexConfig?: { vertexAI?: boolean; project?: string },
): AuthConfig => {
  const resolved: AuthConfig = {};

  // For Vertex AI, prioritize project-based auth over API keys
  if (vertexConfig?.vertexAI) {
    const projectId = vertexConfig.project || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) {
      resolved.projectId = projectId;
    }
  }

  const apiKey = modelConfig?.apiKey ?? fallback.apiKey;
  // Only use API key if not in Vertex AI mode
  if (apiKey && !vertexConfig?.vertexAI) {
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

const buildAuthOptions = (
  config: AuthConfig,
  vertexConfig?: { vertexAI?: boolean; location?: string },
): GoogleClientOptions => {
  const options: GoogleClientOptions = {};

  if (config.credentials) {
    options.credentials = config.credentials;
  }

  if (config.keyFilename) {
    options.keyFilename = config.keyFilename;
  }

  // Only use API key if not using Vertex AI
  if (config.apiKey && !vertexConfig?.vertexAI) {
    options.apiKey = config.apiKey;
  }

  // For Vertex AI, set the project ID
  if (config.projectId) {
    options.projectId = config.projectId;
  }

  return options;
};

const DEFAULT_VOICE = 'en-US-Casual-K';

/**
 * GoogleVoice class provides Text-to-Speech and Speech-to-Text capabilities using Google Cloud services.
 * Supports both standard Google Cloud API authentication and Vertex AI mode for enterprise deployments.
 *
 * @class GoogleVoice
 * @extends MastraVoice
 *
 * @example Standard usage with API key
 * ```typescript
 * const voice = new GoogleVoice({
 *   speechModel: { apiKey: 'your-api-key' },
 *   speaker: 'en-US-Studio-O',
 * });
 * ```
 *
 * @example Vertex AI mode (recommended for production)
 * ```typescript
 * const voice = new GoogleVoice({
 *   vertexAI: true,
 *   project: 'your-gcp-project',
 *   location: 'us-central1',
 *   speaker: 'en-US-Studio-O',
 * });
 * ```
 *
 * @example Vertex AI with service account
 * ```typescript
 * const voice = new GoogleVoice({
 *   vertexAI: true,
 *   project: 'your-gcp-project',
 *   speechModel: {
 *     keyFilename: '/path/to/service-account.json',
 *   },
 * });
 * ```
 */
export class GoogleVoice extends MastraVoice {
  private ttsClient: TextToSpeechClient;
  private speechClient: SpeechClient;
  private readonly vertexAI: boolean;
  private readonly project?: string;
  private readonly location: string;

  /**
   * Creates an instance of GoogleVoice
   * @param {GoogleVoiceConfig} config - Configuration options
   * @param {GoogleModelConfig} [config.speechModel] - Configuration for speech synthesis
   * @param {GoogleModelConfig} [config.listeningModel] - Configuration for speech recognition
   * @param {string} [config.speaker] - Default voice ID to use for speech synthesis
   * @param {boolean} [config.vertexAI] - Enable Vertex AI mode
   * @param {string} [config.project] - Google Cloud project ID (required for Vertex AI)
   * @param {string} [config.location] - Google Cloud region (default: 'us-central1')
   */
  constructor({ listeningModel, speechModel, speaker, vertexAI = false, project, location }: GoogleVoiceConfig = {}) {
    const defaultApiKey = process.env.GOOGLE_API_KEY;
    const defaultKeyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const defaultSpeaker = DEFAULT_VOICE;

    // Resolve Vertex AI configuration
    const resolvedProject = project || process.env.GOOGLE_CLOUD_PROJECT;
    const resolvedLocation = location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    // Validate Vertex AI configuration
    if (vertexAI && !resolvedProject) {
      throw new Error(
        'Google Cloud project ID is required when using Vertex AI. ' +
          'Set GOOGLE_CLOUD_PROJECT environment variable or pass project to constructor.',
      );
    }

    const vertexConfig = { vertexAI, project: resolvedProject };

    const sharedFallback: AuthConfig = {
      apiKey: defaultApiKey ?? speechModel?.apiKey ?? listeningModel?.apiKey,
      keyFilename: defaultKeyFilename ?? speechModel?.keyFilename ?? listeningModel?.keyFilename,
      credentials: speechModel?.credentials ?? listeningModel?.credentials,
      projectId: resolvedProject,
    };

    const speechAuthConfig = resolveAuthConfig(speechModel, sharedFallback, vertexConfig);
    const listeningAuthConfig = resolveAuthConfig(listeningModel, sharedFallback, vertexConfig);

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

    this.vertexAI = vertexAI;
    this.project = resolvedProject;
    this.location = resolvedLocation;

    const ttsOptions = buildAuthOptions(speechAuthConfig, { vertexAI, location: resolvedLocation });
    const speechOptions = buildAuthOptions(listeningAuthConfig, { vertexAI, location: resolvedLocation });

    this.ttsClient = new TextToSpeechClient(ttsOptions);
    this.speechClient = new SpeechClient(speechOptions);
  }

  /**
   * Check if Vertex AI mode is enabled
   * @returns {boolean} True if using Vertex AI
   */
  isUsingVertexAI(): boolean {
    return this.vertexAI;
  }

  /**
   * Get the configured Google Cloud project ID
   * @returns {string | undefined} The project ID or undefined if not set
   */
  getProject(): string | undefined {
    return this.project;
  }

  /**
   * Get the configured Google Cloud location/region
   * @returns {string} The location (default: 'us-central1')
   */
  getLocation(): string {
    return this.location;
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
