import { File } from 'node:buffer';
import { MastraVoice } from '@mastra/core/voice';
import { ElevenLabsClient } from 'elevenlabs';

type ElevenLabsModel =
  | 'eleven_multilingual_v2'
  | 'eleven_flash_v2_5'
  | 'eleven_flash_v2'
  | 'eleven_multilingual_sts_v2'
  | 'eleven_english_sts_v2'
  | 'scribe_v1';

interface ElevenLabsVoiceConfig {
  name?: ElevenLabsModel;
  apiKey?: string;
}

interface SpeechToTextOptions {
  language_code?: string;
  tag_audio_events?: boolean;
  num_speakers?: number;
  filetype?: string;
}

interface RequestOptions {
  timeoutInSeconds?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  apiKey?: string | undefined;
  headers?: Record<string, string>;
}

// Combined options type
type ElevenLabsListenOptions = SpeechToTextOptions & RequestOptions;

export class ElevenLabsVoice extends MastraVoice {
  private client: ElevenLabsClient;

  /**
   * Creates an instance of the ElevenLabsVoice class.
   *
   * @param {Object} options - The options for the voice configuration.
   * @param {ElevenLabsVoiceConfig} [options.speechModel] - The configuration for the speech model, including the model name and API key.
   * @param {string} [options.speaker] - The ID of the speaker to use. If not provided, a default speaker will be used.
   *
   * @throws {Error} If the ELEVENLABS_API_KEY is not set in the environment variables.
   */
  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: { speechModel?: ElevenLabsVoiceConfig; listeningModel?: ElevenLabsVoiceConfig; speaker?: string } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.ELEVENLABS_API_KEY;
    super({
      speechModel: {
        name: speechModel?.name ?? 'eleven_multilingual_v2',
        apiKey: speechModel?.apiKey,
      },
      listeningModel: {
        name: listeningModel?.name ?? 'scribe_v1',
        apiKey: listeningModel?.apiKey,
      },
      speaker,
    });

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set');
    }

    this.client = new ElevenLabsClient({
      apiKey,
    });

    this.speaker = speaker || '9BWtsMINqrJLrRacOk9x'; // Aria is the default speaker
  }

  /**
   * Retrieves a list of available speakers from the Eleven Labs API.
   * Each speaker includes their ID, name, language, and gender.
   *
   * @returns {Promise<Array<{ voiceId: string, name: string, language: string, gender: string }>>}
   * A promise that resolves to an array of speaker objects.
   */
  async getSpeakers() {
    const res = await this.traced(async () => {
      const voices = await this.client.voices.getAll();
      return (
        voices?.voices?.map(voice => ({
          voiceId: voice.voice_id,
          name: voice.name,
          language: voice.labels?.language || 'en',
          gender: voice.labels?.gender || 'neutral',
        })) ?? []
      );
    }, 'voice.elevenlabs.voices')();

    return res;
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
   * Converts text or audio input into speech using the Eleven Labs API.
   *
   * @param {string | NodeJS.ReadableStream} input - The text to be converted to speech or a stream containing audio data.
   * @param {Object} [options] - Optional parameters for the speech generation.
   * @param {string} [options.speaker] - The ID of the speaker to use for the speech. If not provided, the default speaker will be used.
   *
   * @returns {Promise<NodeJS.ReadableStream>} A promise that resolves to a readable stream of the generated speech.
   *
   * @throws {Error} If no speaker is specified or if no speech model is set.
   */
  async speak(input: string | NodeJS.ReadableStream, options?: { speaker?: string }): Promise<NodeJS.ReadableStream> {
    const speaker = options?.speaker || this.speaker;
    if (!speaker) {
      throw new Error('No speaker specified');
    }

    if (!this.speechModel?.name) {
      throw new Error('No speech model specified');
    }
    const text = typeof input === 'string' ? input : await this.streamToString(input);
    const res = await this.traced(async () => {
      return await this.client.generate({
        text,
        voice: speaker,
        model_id: this.speechModel?.name as ElevenLabsModel,
        stream: true,
      });
    }, 'voice.elevenlabs.speak')();

    return res;
  }

  /**
   * Converts audio input to text using ElevenLabs Speech-to-Text API.
   *
   * @param input - A readable stream containing the audio data to transcribe
   * @param options - Configuration options for the transcription
   * @param options.language_code - ISO language code (e.g., 'en', 'fr', 'es')
   * @param options.tag_audio_events - Whether to tag audio events like [MUSIC], [LAUGHTER], etc.
   * @param options.num_speakers - Number of speakers to detect in the audio
   * @param options.filetype - Audio file format (e.g., 'mp3', 'wav', 'ogg')
   * @param options.timeoutInSeconds - Request timeout in seconds
   * @param options.maxRetries - Maximum number of retry attempts
   * @param options.abortSignal - Signal to abort the request
   *
   * @returns A Promise that resolves to the transcribed text
   *
   */
  async listen(input: NodeJS.ReadableStream, options?: ElevenLabsListenOptions): Promise<string> {
    const res = await this.traced(async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      const buffer = Buffer.concat(chunks);

      const { language_code, tag_audio_events, num_speakers, filetype, ...requestOptions } = options || {};

      const file = new File([buffer], `audio.${filetype || 'mp3'}`);

      const transcription = await this.client.speechToText.convert(
        {
          file: file,
          model_id: this.listeningModel?.name as ElevenLabsModel,
          language_code,
          tag_audio_events,
          num_speakers,
        },
        requestOptions,
      );

      return transcription.text;
    }, 'voice.elevenlabs.listen')();

    return res;
  }
}
