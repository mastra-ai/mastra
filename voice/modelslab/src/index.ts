import { Readable } from 'node:stream';

import { MastraVoice } from '@mastra/core/voice';

const MODELSLAB_TTS_URL = 'https://modelslab.com/api/v6/voice/text_to_speech';
const MODELSLAB_TTS_FETCH_URL = 'https://modelslab.com/api/v6/voice/fetch/';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000;

type ModelsLabModel = 'default';

export type ModelsLabVoiceId =
  | '1'  // Neutral
  | '2'  // Male
  | '3'  // Warm
  | '4'  // Deep Male
  | '5'  // Female
  | '6'; // Clear Female

export const MODELSLAB_VOICES: { voiceId: ModelsLabVoiceId; name: string; language: string; gender: string }[] = [
  { voiceId: '1', name: 'Neutral', language: 'en', gender: 'neutral' },
  { voiceId: '2', name: 'Male', language: 'en', gender: 'male' },
  { voiceId: '3', name: 'Warm', language: 'en', gender: 'male' },
  { voiceId: '4', name: 'Deep Male', language: 'en', gender: 'male' },
  { voiceId: '5', name: 'Female', language: 'en', gender: 'female' },
  { voiceId: '6', name: 'Clear Female', language: 'en', gender: 'female' },
];

// OpenAI voice → ModelsLab voice_id mapping
const OPENAI_VOICE_MAP: Record<string, ModelsLabVoiceId> = {
  alloy: '1',
  echo: '2',
  fable: '3',
  onyx: '4',
  nova: '5',
  shimmer: '6',
};

interface ModelsLabVoiceConfig {
  name?: ModelsLabModel;
  apiKey?: string;
}

interface TtsApiResponse {
  status: 'success' | 'processing' | 'error';
  output?: string;
  request_id?: string | number;
  eta?: number;
  message?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ModelsLab voice provider for Mastra.
 *
 * Uses ModelsLab's TTS API with key-in-body authentication and async polling.
 * API docs: https://docs.modelslab.com
 *
 * @example
 * ```ts
 * const voice = new ModelsLabVoice({
 *   speechModel: { apiKey: process.env.MODELSLAB_API_KEY },
 *   speaker: '5', // Female voice
 * });
 *
 * const stream = await voice.speak('Hello, world!');
 * ```
 */
export class ModelsLabVoice extends MastraVoice {
  private apiKey: string;

  constructor({
    speechModel,
    speaker,
  }: {
    speechModel?: ModelsLabVoiceConfig;
    speaker?: ModelsLabVoiceId | string;
  } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.MODELSLAB_API_KEY;

    super({
      speechModel: {
        name: speechModel?.name ?? 'default',
        apiKey,
      },
      speaker: speaker ?? '1',
    });

    if (!apiKey) {
      throw new Error('MODELSLAB_API_KEY is not set');
    }

    this.apiKey = apiKey;
  }

  /**
   * Returns available ModelsLab voices.
   */
  async getSpeakers(): Promise<{ voiceId: string; name: string; language: string; gender: string }[]> {
    return MODELSLAB_VOICES;
  }

  /**
   * Converts text to speech using the ModelsLab TTS API.
   *
   * ModelsLab returns an audio URL (not a stream). This method:
   * 1. POSTs to the TTS endpoint
   * 2. If processing, polls until the audio URL is ready
   * 3. Downloads the audio and returns a Readable stream
   *
   * @param input - Text to convert to speech
   * @param options - Optional parameters
   * @param options.speaker - ModelsLab voice ID (1–10) or OpenAI voice name (alloy, echo, etc.)
   * @param options.language - Language code (default: 'english')
   * @param options.speed - Speech speed (0.5–2.0, default: 1.0)
   * @returns A Promise resolving to a Readable audio stream
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: ModelsLabVoiceId | string;
      language?: string;
      speed?: number;
      [key: string]: unknown;
    },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    // Resolve voice_id: accept numeric ID or OpenAI-style voice name
    const rawSpeaker = options?.speaker ?? this.speaker ?? '1';
    const voiceId = OPENAI_VOICE_MAP[rawSpeaker] ?? rawSpeaker;

    const body = {
      key: this.apiKey,
      prompt: text,
      language: options?.language ?? 'english',
      voice_id: parseInt(voiceId, 10) || 1,
      speed: options?.speed ?? 1.0,
    };

    const initResp = await fetch(MODELSLAB_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!initResp.ok) {
      throw new Error(`ModelsLab TTS failed: ${initResp.status} ${initResp.statusText}`);
    }

    let data = (await initResp.json()) as TtsApiResponse;

    if (data.status === 'error') {
      throw new Error(`ModelsLab TTS error: ${data.message ?? 'Unknown error'}`);
    }

    if (data.status === 'processing') {
      const requestId = String(data.request_id ?? '');
      if (!requestId) {
        throw new Error('ModelsLab TTS returned processing status without request_id');
      }
      data = await this.pollUntilReady(requestId);
    }

    const audioUrl = data.output;
    if (!audioUrl) {
      throw new Error('ModelsLab TTS returned no audio URL');
    }

    // Download audio and return as Readable stream
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      throw new Error(`Failed to download ModelsLab audio: ${audioResp.status}`);
    }

    const audioBuffer = await audioResp.arrayBuffer();
    const readable = new Readable();
    readable.push(Buffer.from(audioBuffer));
    readable.push(null);

    return readable;
  }

  /**
   * ModelsLab does not provide speech-to-text. Throws NotImplemented.
   */
  async listen(_input: NodeJS.ReadableStream, _options?: Record<string, unknown>): Promise<string> {
    throw new Error(
      'ModelsLab does not support speech-to-text. Use a different provider for listening (e.g., @mastra/voice-deepgram).',
    );
  }

  private async pollUntilReady(requestId: string): Promise<TtsApiResponse> {
    const fetchUrl = `${MODELSLAB_TTS_FETCH_URL}${requestId}`;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: this.apiKey }),
      });

      if (!resp.ok) {
        throw new Error(`ModelsLab TTS poll failed: ${resp.status}`);
      }

      const data = (await resp.json()) as TtsApiResponse;

      if (data.status === 'error') {
        throw new Error(`ModelsLab TTS failed: ${data.message ?? 'Unknown error'}`);
      }

      if (data.status === 'success') {
        return data;
      }
      // status === 'processing' → keep polling
    }

    throw new Error(`ModelsLab TTS timed out after ${POLL_TIMEOUT_MS / 1000}s (request_id=${requestId})`);
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk as Buffer);
      }
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
