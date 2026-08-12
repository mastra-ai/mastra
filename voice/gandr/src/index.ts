import { PassThrough } from 'node:stream';

import { MastraVoice } from '@internal/voice';

type GandrVoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'ash' | 'coral' | 'sage' | 'gandr-mia' | 'gandr-nova';

export interface GandrConfig {
  name?: string;
  apiKey?: string;
  baseURL?: string;
}

export interface GandrVoiceConfig {
  speech?: GandrConfig;
  speaker?: GandrVoiceId;
}

export class GandrVoice extends MastraVoice {
  speechApiKey?: string;
  speechBaseURL: string;

  constructor({ speechModel, speaker }: { speechModel?: GandrConfig; speaker?: string } = {}) {
    const defaultApiKey = process.env.GANDR_API_KEY;
    super({
      speechModel: {
        name: speechModel?.name ?? 'tts-1',
        apiKey: speechModel?.apiKey ?? defaultApiKey,
      },
      speaker: speaker ?? 'alloy',
    });

    this.speechApiKey = speechModel?.apiKey || defaultApiKey;
    if (!this.speechApiKey) {
      throw new Error('No API key provided for the Gandr speech model. Set GANDR_API_KEY or pass speechModel.apiKey.');
    }
    this.speechBaseURL = speechModel?.baseURL ?? 'https://tts.gandr.ai/v1';
  }

  async getSpeakers(): Promise<Array<{ voiceId: GandrVoiceId }>> {
    return [
      { voiceId: 'alloy' },
      { voiceId: 'echo' },
      { voiceId: 'fable' },
      { voiceId: 'onyx' },
      { voiceId: 'nova' },
      { voiceId: 'shimmer' },
      { voiceId: 'ash' },
      { voiceId: 'coral' },
      { voiceId: 'sage' },
    ];
  }

  async speak(
    input: string | NodeJS.ReadableStream,
    options?: { speaker?: string; speed?: number; [key: string]: any },
  ): Promise<NodeJS.ReadableStream> {
    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(chunk);
        }
      }
      input = Buffer.concat(chunks).toString('utf-8');
    }
    if (input.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const { speaker, responseFormat, speed, ...otherOptions } = options || {};

    // Gandr's door renders WAV or PCM. response_format mp3 is rejected (no mp3 encoder),
    // so default to wav and surface a warning when a caller asks for something else.
    const format = responseFormat ?? 'wav';
    const body = {
      model: this.speechModel?.name ?? 'tts-1',
      voice: (speaker ?? this.speaker) as string,
      response_format: format,
      input,
      speed: speed || 1.0,
      ...otherOptions,
    };

    const res = await fetch(`${this.speechBaseURL}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.speechApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gandr TTS request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const passThrough = new PassThrough();
    passThrough.end(Buffer.from(await res.arrayBuffer()));
    return passThrough;
  }

  async getListener() {
    return { enabled: false };
  }
}
