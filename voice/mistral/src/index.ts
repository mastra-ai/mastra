import { PassThrough } from 'node:stream';

import { MastraVoice } from '@internal/voice';
import { Mistral } from '@mistralai/mistralai';

type MistralSpeechModel = 'voxtral-mini-tts-2603' | (string & {});
type MistralOutputFormat = 'pcm' | 'wav' | 'mp3' | 'flac' | 'opus';

const DEFAULT_SPEAKER = 'en_paul_neutral';

export interface MistralModelConfig {
  name?: string;
  apiKey?: string;
}

export interface MistralSpeakOptions {
  speaker?: string;
  responseFormat?: MistralOutputFormat;
  refAudio?: string;
  model?: MistralSpeechModel;
  stream?: boolean;
  [key: string]: any;
}

export interface MistralListenOptions {
  language?: string;
  diarize?: boolean;
  contextBias?: string[];
  timestampGranularities?: ('segment' | 'word')[];
  filetype?: string;
  [key: string]: any;
}

export class MistralVoice extends MastraVoice {
  private speechClient: Mistral;
  private listeningClient: Mistral;

  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: {
    speechModel?: MistralModelConfig;
    listeningModel?: MistralModelConfig;
    speaker?: string;
  } = {}) {
    const defaultApiKey = process.env.MISTRAL_API_KEY;

    super({
      speechModel: {
        name: speechModel?.name ?? 'voxtral-mini-tts-2603',
        apiKey: speechModel?.apiKey ?? defaultApiKey,
      },
      listeningModel: {
        name: listeningModel?.name ?? 'voxtral-mini-latest',
        apiKey: listeningModel?.apiKey ?? defaultApiKey,
      },
      speaker: speaker ?? DEFAULT_SPEAKER,
    });

    const speechApiKey = speechModel?.apiKey ?? defaultApiKey;
    if (!speechApiKey) {
      throw new Error('No API key provided for speech model. Set MISTRAL_API_KEY or pass apiKey in speechModel.');
    }
    this.speechClient = new Mistral({ apiKey: speechApiKey });

    const listeningApiKey = listeningModel?.apiKey ?? defaultApiKey;
    if (!listeningApiKey) {
      throw new Error('No API key provided for listening model. Set MISTRAL_API_KEY or pass apiKey in listeningModel.');
    }
    this.listeningClient = new Mistral({ apiKey: listeningApiKey });
  }

  async getSpeakers(): Promise<Array<{ voiceId: string; name: string; languages?: string[]; gender?: string | null }>> {
    const response = await this.speechClient.audio.voices.list({ type: 'preset', limit: 100 });
    return response.items.map(voice => ({
      voiceId: voice.id,
      name: voice.name,
      languages: voice.languages,
      gender: voice.gender,
    }));
  }

  async speak(input: string | NodeJS.ReadableStream, options?: MistralSpeakOptions): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    if (text.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const { speaker, responseFormat, refAudio, model, stream: useStreaming, ...rest } = options ?? {};

    const voiceId = speaker ?? this.speaker ?? undefined;
    const speechModel = model ?? this.speechModel?.name ?? 'voxtral-mini-tts-2603';

    if (useStreaming) {
      return this.speakStreaming(text, speechModel, voiceId, responseFormat, refAudio, rest);
    }

    const response = await this.speechClient.audio.speech.complete({
      input: text,
      model: speechModel,
      voiceId,
      refAudio,
      responseFormat,
      stream: false,
      ...rest,
    });

    const audioBuffer = Buffer.from(response.audioData, 'base64');
    const passThrough = new PassThrough();
    passThrough.end(audioBuffer);
    return passThrough;
  }

  private async speakStreaming(
    text: string,
    model: string,
    voiceId?: string,
    responseFormat?: MistralOutputFormat,
    refAudio?: string,
    rest?: Record<string, any>,
  ): Promise<NodeJS.ReadableStream> {
    const eventStream = await this.speechClient.audio.speech.complete({
      input: text,
      model,
      voiceId,
      refAudio,
      responseFormat,
      stream: true,
      ...rest,
    });

    const passThrough = new PassThrough();

    (async () => {
      try {
        for await (const event of eventStream) {
          if (event.data.type === 'speech.audio.delta') {
            const chunk = Buffer.from(event.data.audioData, 'base64');
            passThrough.write(chunk);
          }
        }
        passThrough.end();
      } catch (error) {
        passThrough.destroy(error as Error);
      }
    })().catch(error => {
      passThrough.destroy(error as Error);
    });

    return passThrough;
  }

  async getListener() {
    return { enabled: true };
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: MistralListenOptions): Promise<string> {
    const audioBuffer = await this.streamToBuffer(audioStream);

    const { language, diarize, contextBias, timestampGranularities, filetype, ...rest } = options ?? {};

    const response = await this.listeningClient.audio.transcriptions.complete({
      model: this.listeningModel?.name ?? 'voxtral-mini-latest',
      file: {
        fileName: `audio.${filetype ?? 'mp3'}`,
        content: new Uint8Array(audioBuffer),
      },
      language,
      diarize,
      contextBias,
      timestampGranularities,
      ...rest,
    });

    return response.text;
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

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks);
  }
}
