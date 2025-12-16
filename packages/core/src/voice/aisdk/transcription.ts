import { experimental_transcribe } from '@internal/ai-sdk-v5';
import type { TranscriptionModel } from '@internal/ai-sdk-v5';
import { MastraVoice } from '../voice';

export class AISDKTranscription extends MastraVoice {
  private model: TranscriptionModel;

  constructor(model: TranscriptionModel) {
    super({ name: 'ai-sdk-transcription' });
    this.model = model;
  }

  async speak(): Promise<NodeJS.ReadableStream> {
    throw new Error('AI SDK transcription models do not support text-to-speech. Use AISDKSpeech instead.');
  }

  async getSpeakers() {
    return [];
  }

  async getListener() {
    return { enabled: true };
  }

  /**
   * Transcribe audio to text
   * For enhanced metadata (segments, language, duration), use AI SDK's transcribe() directly
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: {
      providerOptions?: Record<string, any>;
      abortSignal?: AbortSignal;
      headers?: Record<string, string>;
    },
  ): Promise<string> {
    const audioBuffer = await this.convertToBuffer(audioStream);

    const result = await experimental_transcribe({
      model: this.model,
      audio: audioBuffer,
      providerOptions: options?.providerOptions,
      abortSignal: options?.abortSignal,
      headers: options?.headers,
    });

    return result.text;
  }

  private async convertToBuffer(audio: NodeJS.ReadableStream | Buffer | Uint8Array | string): Promise<Buffer> {
    if (Buffer.isBuffer(audio)) return audio;
    if (audio instanceof Uint8Array) return Buffer.from(audio);
    if (typeof audio === 'string') return Buffer.from(audio, 'base64');

    const chunks: Buffer[] = [];
    for await (const chunk of audio) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
