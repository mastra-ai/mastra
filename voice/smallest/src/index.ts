import { PassThrough } from 'node:stream';

import { MastraVoice } from '@internal/voice';
import type {
  SmallestOutputFormat,
  SmallestSampleRate,
  SmallestSTTModel,
  SmallestTTSModel,
  SmallestVoiceTags,
} from './models';

export * from './models';

/** Longest text the Lightning models accept in a single request. */
export const SMALLEST_MAX_INPUT_CHARS = 250;

interface SmallestSpeechConfig {
  apiKey?: string;
  model?: SmallestTTSModel;
  /**
   * ISO 639-1 code, or `auto` to route on the input text. `auto` is what lets a
   * single Indian-accent voice code-switch between English and Hindi.
   */
  language?: string;
  sampleRate?: SmallestSampleRate;
  /** Playback speed, 0.5–2.0. */
  speed?: number;
  outputFormat?: SmallestOutputFormat;
}

interface SmallestListeningConfig {
  apiKey?: string;
  model?: SmallestSTTModel;
  language?: string;
}

interface SmallestSpeakOptions {
  speaker?: string;
  speed?: number;
  sampleRate?: SmallestSampleRate;
  outputFormat?: SmallestOutputFormat;
}

interface SmallestListenOptions {
  model?: SmallestSTTModel;
  language?: string;
  wordTimestamps?: boolean;
}

interface SmallestSpeaker {
  voiceId: string;
  displayName?: string;
  tags?: SmallestVoiceTags;
}

const BASE_URL = 'https://api.smallest.ai/waves/v1';

const defaultSpeechModel = {
  model: 'lightning_v3.1_pro' as const,
  apiKey: process.env.SMALLEST_API_KEY,
  language: 'auto',
  outputFormat: 'wav' as const,
};

const defaultListeningModel = {
  model: 'pulse' as const,
  apiKey: process.env.SMALLEST_API_KEY,
};

const DEFAULT_SPEAKER = 'meher';

/**
 * The only catalog Smallest exposes. It spells the model with hyphens even
 * though the synthesis body spells the same model with underscores, and it is
 * not per-pool: `lightning-v3.1` returns the standard and Pro voices together.
 */
const VOICE_CATALOG_PATH = 'lightning-v3.1/get_voices';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function assertOk(response: Response, scope: string): Promise<Response> {
  if (response.ok) {
    return response;
  }
  const detail = await response.text().catch(() => '');
  // Keep the status in the message: 429 means the account's concurrency cap was
  // hit and the call is worth retrying, while a 4xx will fail the same way again.
  throw new Error(
    `Smallest AI ${scope} error [${response.status} ${response.statusText}]: ${detail.slice(0, 300) || response.statusText}`,
  );
}

/**
 * Smallest AI voice provider.
 *
 * - `speak()` uses Waves Lightning text-to-speech.
 * - `listen()` uses Pulse pre-recorded speech-to-text.
 *
 * @example
 * ```typescript
 * const voice = new SmallestVoice({ speaker: 'meher' });
 * const audio = await voice.speak('Hello from Mastra!');
 * ```
 */
export class SmallestVoice extends MastraVoice {
  private apiKey?: string;
  private listenApiKey?: string;
  private model: SmallestTTSModel;
  private language: string;
  private sampleRate?: SmallestSampleRate;
  private speed?: number;
  private outputFormat: SmallestOutputFormat;
  private listeningOptions: SmallestListeningConfig;
  speaker: string;

  constructor({
    speechModel,
    speaker,
    listeningModel,
  }: {
    speechModel?: SmallestSpeechConfig;
    speaker?: string;
    listeningModel?: SmallestListeningConfig;
  } = {}) {
    super({
      speechModel: {
        name: speechModel?.model ?? defaultSpeechModel.model,
        apiKey: speechModel?.apiKey ?? defaultSpeechModel.apiKey,
      },
      listeningModel: {
        name: listeningModel?.model ?? defaultListeningModel.model,
        apiKey: listeningModel?.apiKey ?? defaultListeningModel.apiKey,
      },
      speaker,
    });

    this.apiKey = speechModel?.apiKey || listeningModel?.apiKey || defaultSpeechModel.apiKey;
    if (!this.apiKey) {
      throw new Error('SMALLEST_API_KEY must be set');
    }
    this.listenApiKey = listeningModel?.apiKey || this.apiKey;
    this.model = speechModel?.model || defaultSpeechModel.model;
    this.language = speechModel?.language || defaultSpeechModel.language;
    this.sampleRate = speechModel?.sampleRate;
    this.speed = speechModel?.speed;
    this.outputFormat = speechModel?.outputFormat || defaultSpeechModel.outputFormat;
    this.speaker = speaker || DEFAULT_SPEAKER;
    this.listeningOptions = listeningModel ?? {};
  }

  /**
   * Synthesize speech. Voices are pool-specific — pairing a Pro voice with the
   * standard model produces unintelligible audio rather than an error, so check
   * the model card for the pool you configured.
   *
   * @throws if `input` exceeds {@link SMALLEST_MAX_INPUT_CHARS}; split longer
   * text on sentence boundaries and stream the segments in order.
   */
  async speak(input: string | NodeJS.ReadableStream, options?: SmallestSpeakOptions): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : (await streamToBuffer(input)).toString('utf-8');
    if (!text.trim()) {
      throw new Error('Input text is empty');
    }
    if (text.length > SMALLEST_MAX_INPUT_CHARS) {
      throw new Error(
        `Input is ${text.length} characters; Smallest AI accepts at most ${SMALLEST_MAX_INPUT_CHARS} per request. Split the text on sentence boundaries and speak each segment.`,
      );
    }

    const sampleRate = options?.sampleRate ?? this.sampleRate;
    const speed = options?.speed ?? this.speed;
    const response = await fetch(`${BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        // Without an explicit audio Accept the API can answer with an empty or
        // unplayable body instead of the encoded audio.
        Accept: 'audio/wav',
      },
      body: JSON.stringify({
        text,
        voice_id: options?.speaker || this.speaker,
        model: this.model,
        language: this.language,
        output_format: options?.outputFormat ?? this.outputFormat,
        ...(sampleRate ? { sample_rate: sampleRate } : {}),
        ...(speed ? { speed } : {}),
      }),
    });

    await assertOk(response, 'TTS');

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      throw new Error('No audio received from Smallest AI');
    }

    const stream = new PassThrough();
    stream.end(audio);
    return stream;
  }

  /**
   * Transcribe pre-recorded audio with Pulse. `pulse-pro` is English-only;
   * `pulse` is the multilingual model.
   */
  async listen(input: NodeJS.ReadableStream, options?: SmallestListenOptions): Promise<string> {
    const audio = await streamToBuffer(input);
    if (audio.length === 0) {
      throw new Error('Input audio is empty');
    }

    const params = new URLSearchParams({
      model: options?.model || this.listeningOptions.model || defaultListeningModel.model,
    });
    const language = options?.language ?? this.listeningOptions.language;
    if (language) {
      params.set('language', language);
    }
    if (options?.wordTimestamps) {
      params.set('word_timestamps', 'true');
    }

    const response = await fetch(`${BASE_URL}/stt/?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.listenApiKey}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(audio),
    });

    await assertOk(response, 'STT');

    const { transcription } = (await response.json()) as { transcription?: string };
    return transcription ?? '';
  }

  /**
   * List the Lightning voices. The catalog is large and moves, so it is fetched
   * rather than bundled. It covers the standard and Pro pools at once and
   * carries no per-voice pool flag, so a voice taken from here may still need
   * `model: 'lightning_v3.1_pro'` to synthesize.
   */
  async getSpeakers(): Promise<SmallestSpeaker[]> {
    const response = await fetch(`${BASE_URL}/${VOICE_CATALOG_PATH}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    await assertOk(response, 'voices');

    const { voices } = (await response.json()) as { voices?: SmallestSpeaker[] };
    return voices ?? [];
  }

  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: true };
  }
}
