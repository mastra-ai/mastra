import { PassThrough } from 'node:stream';
import { MastraVoice } from '@mastra/core/voice';

const INWORLD_API_BASE = 'https://api.inworld.ai';

type InworldTtsModel = 'inworld-tts-1.5-max' | 'inworld-tts-1.5-mini';

type InworldSttModel =
  | 'inworld/inworld-stt-1'
  | 'groq/whisper-large-v3'
  | 'assemblyai/universal-streaming-multilingual';

type AudioEncoding = 'LINEAR16' | 'MP3' | 'OGG_OPUS' | 'ALAW' | 'MULAW' | 'FLAC' | 'PCM' | 'WAV';

type SttAudioEncoding = 'LINEAR16' | 'MP3' | 'OGG_OPUS' | 'FLAC' | 'AUTO_DETECT';

interface InworldVoiceConfig {
  name?: InworldTtsModel;
  apiKey?: string;
}

interface InworldListeningConfig {
  name?: InworldSttModel;
  apiKey?: string;
}

interface InworldSpeakOptions {
  speaker?: string;
  audioEncoding?: AudioEncoding;
  sampleRateHertz?: number;
  speakingRate?: number;
  temperature?: number;
}

interface InworldListenOptions {
  audioEncoding?: SttAudioEncoding;
  sampleRateHertz?: number;
  language?: string;
}

export type {
  InworldVoiceConfig,
  InworldListeningConfig,
  InworldSpeakOptions,
  InworldListenOptions,
  InworldTtsModel,
  InworldSttModel,
  AudioEncoding,
  SttAudioEncoding,
};

export class InworldVoice extends MastraVoice {
  private apiKey: string;
  private audioEncoding: AudioEncoding;
  private sampleRateHertz: number;
  private language: string;

  /**
   * Creates an instance of the InworldVoice class.
   *
   * @param {Object} options - The options for the voice configuration.
   * @param {InworldVoiceConfig} [options.speechModel] - TTS model config. Default: inworld-tts-1.5-max.
   * @param {InworldListeningConfig} [options.listeningModel] - STT model config. Default: groq/whisper-large-v3.
   * @param {string} [options.speaker] - Default voice ID. Default: 'Dennis'.
   * @param {AudioEncoding} [options.audioEncoding] - TTS audio format. Default: 'MP3'.
   * @param {number} [options.sampleRateHertz] - TTS sample rate. Default: 48000.
   * @param {string} [options.language] - STT language (BCP-47). Default: 'en-US'.
   *
   * @throws {Error} If no API key is provided or found in INWORLD_API_KEY env var.
   */
  constructor({
    speechModel,
    listeningModel,
    speaker,
    audioEncoding,
    sampleRateHertz,
    language,
  }: {
    speechModel?: InworldVoiceConfig;
    listeningModel?: InworldListeningConfig;
    speaker?: string;
    audioEncoding?: AudioEncoding;
    sampleRateHertz?: number;
    language?: string;
  } = {}) {
    const apiKey = speechModel?.apiKey ?? listeningModel?.apiKey ?? process.env.INWORLD_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Inworld API key is required. Pass apiKey in speechModel/listeningModel config or set INWORLD_API_KEY env var.',
      );
    }

    super({
      speechModel: {
        name: speechModel?.name ?? 'inworld-tts-1.5-max',
        apiKey,
      },
      listeningModel: {
        name: listeningModel?.name ?? 'groq/whisper-large-v3',
        apiKey,
      },
      speaker: speaker ?? 'Dennis',
    });

    this.apiKey = apiKey;
    this.audioEncoding = audioEncoding ?? 'MP3';
    this.sampleRateHertz = sampleRateHertz ?? 48000;
    this.language = language ?? 'en-US';
  }

  /**
   * Retrieves a list of available voices from the Inworld API.
   *
   * @returns {Promise<Array<{ voiceId: string; name: string; language: string; gender: string }>>}
   */
  async getSpeakers() {
    const response = await fetch(`${INWORLD_API_BASE}/voices/v1/voices`, {
      headers: { Authorization: `Basic ${this.apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inworld list voices failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      voices?: Array<{
        voiceId: string;
        displayName?: string;
        langCode?: string;
        description?: string;
        tags?: string[];
        source?: string;
      }>;
    };

    return (
      data.voices?.map(v => ({
        voiceId: v.voiceId,
        name: v.displayName ?? v.voiceId,
        language: v.langCode ?? 'en',
        gender: 'neutral',
      })) ?? []
    );
  }

  /**
   * Checks if listening capabilities are enabled.
   */
  async getListener() {
    return { enabled: !!this.listeningModel };
  }

  /**
   * Converts text to speech using Inworld's streaming TTS endpoint.
   *
   * Returns a ReadableStream that emits audio chunks progressively as they
   * arrive from the API — following the same streaming pattern used by the
   * Deepgram and PlayAI Mastra voice providers.
   *
   * Uses the `/tts/v1/voice:stream` endpoint which returns newline-delimited
   * JSON, each line containing a base64-encoded audio chunk.
   *
   * @param {string | NodeJS.ReadableStream} input - Text or stream to convert to speech.
   * @param {InworldSpeakOptions} [options] - TTS options.
   * @returns {Promise<NodeJS.ReadableStream>} Progressive audio stream.
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: InworldSpeakOptions & { speaker?: string },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    if (text.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const speaker = options?.speaker ?? this.speaker;

    const body = {
      text,
      voiceId: speaker,
      modelId: this.speechModel?.name ?? 'inworld-tts-1.5-max',
      audioConfig: {
        audioEncoding: options?.audioEncoding ?? this.audioEncoding,
        sampleRateHertz: options?.sampleRateHertz ?? this.sampleRateHertz,
        ...(options?.speakingRate !== undefined && { speakingRate: options.speakingRate }),
      },
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
    };

    const response = await fetch(`${INWORLD_API_BASE}/tts/v1/voice:stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inworld TTS failed (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Inworld TTS streaming response has no body');
    }

    // Progressive streaming: return the PassThrough immediately while reading
    // NDJSON chunks from the response body in a background async task.
    const outputStream = new PassThrough();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    void (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining data in the buffer before ending
            const remaining = buffer.trim();
            if (remaining) {
              try {
                const chunk = JSON.parse(remaining);
                const audioContent = chunk.result?.audioContent ?? chunk.audioContent;
                if (audioContent) {
                  outputStream.write(Buffer.from(audioContent, 'base64'));
                }
              } catch {
                // skip malformed trailing data
              }
            }
            outputStream.end();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk = JSON.parse(trimmed);
              const audioContent = chunk.result?.audioContent ?? chunk.audioContent;
              if (audioContent) {
                outputStream.write(Buffer.from(audioContent, 'base64'));
              }
            } catch {
              // skip malformed NDJSON lines
            }
          }
        }
      } catch (err) {
        if (!outputStream.destroyed) {
          outputStream.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })().catch(() => {});

    return outputStream;
  }

  /**
   * Converts audio to text using Inworld's batch STT endpoint.
   *
   * @param {NodeJS.ReadableStream} input - Audio stream to transcribe.
   * @param {InworldListenOptions} [options] - STT options.
   * @returns {Promise<string>} Transcribed text.
   */
  async listen(input: NodeJS.ReadableStream, options?: InworldListenOptions): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    const audioBase64 = Buffer.concat(chunks).toString('base64');

    const body = {
      transcribeConfig: {
        modelId: this.listeningModel?.name ?? 'groq/whisper-large-v3',
        audioEncoding: options?.audioEncoding ?? 'AUTO_DETECT',
        language: options?.language ?? this.language,
        sampleRateHertz: options?.sampleRateHertz ?? 16000,
        numberOfChannels: 1,
      },
      audioData: {
        content: audioBase64,
      },
    };

    const response = await fetch(`${INWORLD_API_BASE}/stt/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inworld STT failed (${response.status}): ${text}`);
    }

    const result = (await response.json()) as {
      transcription?: {
        transcript?: string;
        isFinal?: boolean;
      };
    };

    return result.transcription?.transcript ?? '';
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
