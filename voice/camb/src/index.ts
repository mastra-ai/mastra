import { PassThrough } from 'node:stream';

import { MastraVoice } from '@mastra/core/voice';

import type { CambConfig, CambSpeakOptions, CambVoiceInfo, CambSpeechModel, CambOutputFormat } from './types';
import { MODEL_SAMPLE_RATES } from './types';
import { generateWavHeader } from './wav-header';

const DEFAULT_VOICE_ID = 147320; // Attic
const DEFAULT_MODEL: CambSpeechModel = 'mars-pro';
const DEFAULT_OUTPUT_FORMAT: CambOutputFormat = 'wav';
const BASE_URL = 'https://client.camb.ai/apis';

export class CambVoice extends MastraVoice {
  private apiKey: string;
  private model: CambSpeechModel;
  private defaultVoiceId: number;
  private outputFormat: CambOutputFormat;

  constructor({ speechModel, speaker }: { speechModel?: CambConfig; speaker?: string } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.CAMB_API_KEY;

    super({
      speechModel: {
        name: speechModel?.name ?? DEFAULT_MODEL,
        apiKey,
      },
      speaker: speaker ?? String(DEFAULT_VOICE_ID),
    });

    if (!apiKey) {
      throw new Error('CAMB_API_KEY is required. Provide it via config or set the CAMB_API_KEY environment variable.');
    }

    this.apiKey = apiKey;
    this.model = speechModel?.name ?? DEFAULT_MODEL;
    const parsedSpeaker = speaker ? parseInt(speaker, 10) : DEFAULT_VOICE_ID;
    if (Number.isNaN(parsedSpeaker)) {
      throw new Error(`Invalid speaker ID "${speaker}": must be a numeric string`);
    }
    this.defaultVoiceId = parsedSpeaker;
    this.outputFormat = speechModel?.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
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

  async speak(input: string | NodeJS.ReadableStream, options?: CambSpeakOptions): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    if (text.length < 3 || text.length > 3000) {
      throw new Error('Text must be between 3 and 3000 characters');
    }

    const voiceId = options?.speaker ? parseInt(options.speaker, 10) : this.defaultVoiceId;
    if (Number.isNaN(voiceId)) {
      throw new Error(`Invalid speaker ID "${options?.speaker}": must be a numeric string`);
    }

    const payload: Record<string, unknown> = {
      text,
      voice_id: voiceId,
      language: options?.language ?? 'en-us',
      speech_model: this.model,
      output_configuration: {
        format: this.outputFormat,
      },
    };

    if (options?.enhanceNamedEntities !== undefined) {
      payload.enhance_named_entities = options.enhanceNamedEntities;
    }

    // user_instructions is required for mars-instruct model
    if (this.model === 'mars-instruct') {
      if (!options?.userInstructions) {
        throw new Error('userInstructions is required when using mars-instruct model');
      }
      payload.user_instructions = options.userInstructions;
    }

    const response = await fetch(`${BASE_URL}/tts-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Camb AI API Error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body received');
    }

    // Collect all audio chunks
    const audioChunks: Buffer[] = [];
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      audioChunks.push(Buffer.from(value));
    }

    const audioData = Buffer.concat(audioChunks);

    // Create output stream
    const stream = new PassThrough();

    // Only add WAV header if format is pcm_s16le (raw PCM needs header for playback)
    if (this.outputFormat === 'pcm_s16le') {
      const sampleRate = MODEL_SAMPLE_RATES[this.model];
      const wavHeader = generateWavHeader(audioData.length, sampleRate);
      stream.write(wavHeader);
    }

    stream.write(audioData);
    stream.end();

    return stream;
  }

  async getSpeakers(): Promise<Array<{ voiceId: string; name: string; gender: string; age: string; language: string }>> {
    const response = await fetch(`${BASE_URL}/list-voices`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Camb AI API Error: ${response.status} - ${errorText}`);
    }

    const voices = (await response.json()) as CambVoiceInfo[];

    return voices.map(voice => ({
      voiceId: String(voice.id),
      name: voice.voice_name,
      gender: voice.gender,
      age: voice.age,
      language: voice.language,
    }));
  }

  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }

  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error('Camb AI does not support speech recognition');
  }
}

export type { CambConfig, CambSpeakOptions, CambSpeechModel, CambOutputFormat };
export { MODEL_SAMPLE_RATES } from './types';
export { generateWavHeader } from './wav-header';
