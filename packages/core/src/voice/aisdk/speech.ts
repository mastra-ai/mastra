import { PassThrough } from 'node:stream';
import { experimental_generateSpeech } from '@internal/ai-sdk-v5';
import type { SpeechModel } from '@internal/ai-sdk-v5';
import { MastraVoice } from '../voice';

export class AISDKSpeech extends MastraVoice {
  private model: SpeechModel;
  private defaultVoice?: string;

  constructor(model: SpeechModel, options?: { voice?: string }) {
    super({ name: 'ai-sdk-speech' });
    this.model = model;
    this.defaultVoice = options?.voice;
  }

  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      language?: string;
      providerOptions?: Record<string, any>;
      abortSignal?: AbortSignal;
      headers?: Record<string, string>;
    },
  ): Promise<NodeJS.ReadableStream> {
    // Convert stream to text if needed
    const text = typeof input === 'string' ? input : await this.streamToText(input);

    const result = await experimental_generateSpeech({
      model: this.model,
      text,
      voice: options?.speaker || this.defaultVoice, // Map speaker to AI SDK's voice parameter
      language: options?.language,
      providerOptions: options?.providerOptions,
      abortSignal: options?.abortSignal,
      headers: options?.headers,
    });

    // Convert Uint8Array to Node stream
    const stream = new PassThrough();
    stream.end(Buffer.from(result.audio.uint8Array));
    return stream;
  }

  async listen(): Promise<string> {
    throw new Error('AI SDK speech models do not support transcription. Use AISDKTranscription instead.');
  }

  async getSpeakers() {
    // Return empty array - voice must be specified in speak() options
    return [];
  }

  async getListener() {
    return { enabled: false };
  }

  private async streamToText(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
