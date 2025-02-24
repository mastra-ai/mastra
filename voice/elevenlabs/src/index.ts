import { MastraVoice } from '@mastra/core/voice';
import { ElevenLabsClient } from 'elevenlabs';

type ElevenLabsModel =
  | 'eleven_multilingual_v2'
  | 'eleven_flash_v2_5'
  | 'eleven_flash_v2'
  | 'eleven_multilingual_sts_v2'
  | 'eleven_english_sts_v2';

interface ElevenLabsVoiceConfig {
  name?: ElevenLabsModel;
  apiKey?: string;
}

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
  constructor({ speechModel, speaker }: { speechModel?: ElevenLabsVoiceConfig; speaker?: string } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.ELEVENLABS_API_KEY;
    super({
      speechModel: {
        name: speechModel?.name ?? 'eleven_multilingual_v2',
        apiKey: speechModel?.apiKey,
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
      chunks.push(Buffer.from(chunk));
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

  async listen(_input: NodeJS.ReadableStream | Buffer, _options?: Record<string, unknown>): Promise<string> {
    throw new Error('ElevenLabs does not support transcription');
  }
}
