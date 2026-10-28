import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { MastraVoice } from '@internal/voice';
import { SpeechifyClient } from '@speechify/api';
import type { Speechify } from '@speechify/api';

import type { SpeechifyVoiceId } from './voices';

// Injected by tsdown at build time; undefined under vitest and in source form.
declare const __SPEECHIFY_VOICE_VERSION__: string | undefined;

/**
 * Models accepted by the Speechify API. `simba-3.5` is Speechify's recommended
 * model: 48 languages on one id, and every catalog voice speaks all of them.
 * The SDK's union does not list it yet, so it is added here; the SDK sends
 * the value to the API verbatim. `simba-3.2` is English only. `simba-english`
 * and `simba-multilingual` are retired for new workspaces and are served by
 * `simba-3.2` and `simba-3.5` from 2026-11-21.
 */
type SpeechifyModel = Speechify.GetStreamRequest.Model | 'simba-3.5';

const DEFAULT_MODEL: SpeechifyModel = 'simba-3.5';
const SIMBA_3_MODELS: ReadonlySet<string> = new Set(['simba-3.0', 'simba-3.2', 'simba-3.5']);

/** The `harper_32` voice is Speechify's first en-US staff pick; `george` is the classic default. */
const defaultSpeaker = (model: string): SpeechifyVoiceId => (SIMBA_3_MODELS.has(model) ? 'harper_32' : 'george');

/** Container of the streamed audio. `pcm` is signed 16-bit little-endian. */
type SpeechifyAudioFormat = 'mp3' | 'ogg' | 'aac' | 'pcm';

const ACCEPT_HEADER: Record<SpeechifyAudioFormat, Speechify.StreamAudioRequestAccept> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  pcm: 'audio/pcm',
};

interface SpeechifyConfig {
  name?: SpeechifyModel;
  apiKey?: string;
}

interface SpeechifySpeakOptions {
  /** Voice id for this request. Any catalog voice; see `getSpeakers()`. */
  speaker?: SpeechifyVoiceId;
  /** Model for this request. */
  model?: SpeechifyModel;
  /**
   * Locale of the text, such as `pt-BR`. On `simba-3.5` any voice speaks it.
   * When omitted, the voice's own locale decides.
   */
  language?: string;
  /** Container of the audio stream. Defaults to `mp3`. */
  audioFormat?: SpeechifyAudioFormat;
  /** Sample rate and bitrate, such as `mp3_24000_128` or `pcm_16000`. */
  outputFormat?: Speechify.AudioStreamOutputFormat;
  /** Synthesis switches such as `loudness_normalization`. */
  options?: Speechify.GetStreamOptionsRequest;
}

/**
 * Integration attribution, per Speechify's integration guide. It identifies
 * this package's traffic and never changes limits, pricing or access.
 */
function attributionHeaders(): Record<string, string> {
  const version = typeof __SPEECHIFY_VOICE_VERSION__ === 'string' ? __SPEECHIFY_VOICE_VERSION__ : undefined;
  return {
    'Speechify-Caller': 'mastra',
    ...(version ? { 'Speechify-Caller-Version': version } : {}),
  };
}

export class SpeechifyVoice extends MastraVoice {
  private client: SpeechifyClient;
  private readonly explicitSpeaker?: SpeechifyVoiceId;

  constructor({ speechModel, speaker }: { speechModel?: SpeechifyConfig; speaker?: SpeechifyVoiceId } = {}) {
    const modelName = speechModel?.name ?? DEFAULT_MODEL;
    const apiKey = speechModel?.apiKey ?? process.env.SPEECHIFY_API_KEY;
    super({
      speechModel: { name: modelName, apiKey },
      speaker: speaker ?? defaultSpeaker(modelName),
    });

    if (!apiKey) {
      throw new Error('SPEECHIFY_API_KEY is not set');
    }

    this.explicitSpeaker = speaker;
    this.client = new SpeechifyClient({ token: apiKey, headers: attributionHeaders() });
  }

  /**
   * Lists every voice the API key can use, read live from Speechify's
   * catalog, with the models that render each one.
   */
  async getSpeakers() {
    const speakers: Array<{ voiceId: string; name: string; language: string; gender: string; models: string[] }> = [];
    for await (const voice of await this.client.voices.list()) {
      speakers.push({
        voiceId: voice.id,
        name: voice.display_name,
        language: voice.locale,
        gender: voice.gender,
        models: voice.models.map(model => model.name),
      });
    }
    return speakers;
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  async speak(input: string | NodeJS.ReadableStream, options?: SpeechifySpeakOptions): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);
    const { speaker, model, language, audioFormat, outputFormat, options: synthesisOptions } = options ?? {};
    const resolvedModel = model || this.speechModel?.name || DEFAULT_MODEL;

    const response = await this.client.audio.stream({
      Accept: ACCEPT_HEADER[audioFormat ?? 'mp3'],
      body: {
        input: text,
        voice_id:
          speaker ??
          this.explicitSpeaker ??
          (model ? defaultSpeaker(resolvedModel) : this.speaker) ??
          defaultSpeaker(resolvedModel),
        // The SDK sends `model` verbatim, so the wider SpeechifyModel union
        // narrows safely into the SDK's own type.
        model: resolvedModel as Speechify.GetStreamRequest.Model,
        ...(language ? { language } : {}),
        ...(outputFormat ? { output_format: outputFormat } : {}),
        ...(synthesisOptions ? { options: synthesisOptions } : {}),
      },
    });

    const body = response.stream();
    if (!body) {
      throw new Error('Speechify returned an empty audio stream');
    }
    return Readable.fromWeb(body as WebReadableStream<Uint8Array>);
  }

  /**
   * Checks if listening capabilities are enabled.
   *
   * @returns {Promise<{ enabled: boolean }>}
   */
  async getListener() {
    return { enabled: false };
  }

  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error('Speechify does not support speech recognition');
  }
}

export { SPEECHIFY_FEATURED_VOICES } from './voices';
export type { SpeechifyAudioFormat, SpeechifyConfig, SpeechifyModel, SpeechifySpeakOptions, SpeechifyVoiceId };
