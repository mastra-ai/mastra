import type { Readable } from 'stream';
import { MastraVoice } from '@mastra/core/voice';

interface GladiaConfig {
  apiKey: string;
}

interface GladiaListenOptions {
  diarization?: boolean;
  diarization_config?: {
    number_of_speakers?: number;
    min_speakers?: number;
    max_speakers?: number;
  };
  translation?: boolean;
  translation_config?: {
    model?: 'base' | 'enhanced';
    target_languages?: string[];
  };
  detect_language?: boolean;
  enable_code_switching?: boolean;
}

interface GladiaListenCallParams {
  mimeType: string;
  fileName: string;
  options?: GladiaListenOptions;
}

export class GladiaVoice extends MastraVoice {
  private apiKey: string;
  private baseUrl = 'https://api.gladia.io/v2';

  constructor({ listeningModel }: { listeningModel?: GladiaConfig } = {}) {
    const defaultApiKey = process.env.GLADIA_API_KEY;
    super({
      listeningModel: {
        name: 'gladia',
        apiKey: listeningModel?.apiKey ?? defaultApiKey,
      },
    });

    this.apiKey = this.listeningModel?.apiKey as string;
    if (!this.apiKey) throw new Error('GLADIA_API_KEY is not set.');
  }

  async speak(_input: string, _options?: Record<string, unknown>): Promise<any> {
    throw new Error('Gladia does not support text-to-speech.');
  }

  async listen(input: Readable, { mimeType, fileName, options }: GladiaListenCallParams): Promise<string> {
    return this.traced(async () => {
      if (!fileName) {
        throw new Error('fileName is required for audio processing');
      }
      if (!mimeType) {
        throw new Error('mimeType is required for audio processing');
      }
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }

      const audioBuffer = Buffer.concat(chunks);
      const form = new FormData();
      form.append('audio', new Blob([audioBuffer], { type: mimeType }), fileName);

      const uploadRes: any = await fetch(`${this.baseUrl}/upload/`, {
        method: 'POST',
        headers: { 'x-gladia-key': this.apiKey },
        body: form,
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
      }
      const { audio_url } = await uploadRes.json();
      const opts: GladiaListenOptions = {
        diarization: true, // <-- default
        ...options,
      };

      const transcribeRes: any = await fetch(`${this.baseUrl}/pre-recorded/`, {
        method: 'POST',
        headers: {
          'x-gladia-key': this.apiKey,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({ audio_url, ...opts }),
      });

      const { id } = await transcribeRes.json();

      while (true) {
        const pollRes: any = await fetch(`${this.baseUrl}/pre-recorded/${id}`, {
          method: 'GET',
          headers: {
            'x-gladia-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (!pollRes.ok) {
          throw new Error(`Polling failed: ${pollRes.status} ${await pollRes.text()}`);
        }

        const pollJson = await pollRes.json();
        if (pollJson.status === 'done') {
          const transcript = pollJson.result?.transcription?.full_transcript;
          if (!transcript) throw new Error('No transcript found');
          return transcript;
        }

        if (pollJson.status === 'error') {
          throw new Error(`Gladia error: ${pollJson.error || 'Unknown'}`);
        }

        await new Promise(res => setTimeout(res, 1000));
      }
    }, 'voice.gladia.listen')();
  }
}

export type { GladiaConfig, GladiaListenOptions };
export type { GladiaListenCallParams };
