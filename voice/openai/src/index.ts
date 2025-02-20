import { MastraVoice } from '@mastra/core/voice';
import OpenAI from 'openai';
import { PassThrough } from 'stream';

type OpenAIVoiceId = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'ash' | 'coral' | 'sage';
// file types mp3, mp4, mpeg, mpga, m4a, wav, and webm.

interface OpenAIVoiceConfig {
  name: 'tts-1' | 'tts-1-hd' | 'whisper-1';
  apiKey?: string;
}

export class OpenAIVoice extends MastraVoice {
  client: OpenAI;

  constructor({ model }: { model: OpenAIVoiceConfig }) {
    super({
      model: {
        provider: 'OPENAI',
        ...model,
      },
    });

    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || this.model.apiKey });
  }

  async voices() {
    return this.traced(
      () => [
        { voice_id: 'alloy' },
        { voice_id: 'echo' },
        { voice_id: 'fable' },
        { voice_id: 'onyx' },
        { voice_id: 'nova' },
        { voice_id: 'shimmer' },
      ],
      'voice.openai.voices',
    )();
  }

  async speech({ text, voice, speed }: { text: string; voice?: string; speed?: number }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: (voice || 'alloy') as OpenAIVoiceId,
        input: text,
        speed: speed || 1.0,
      });

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    }, 'voice.openai.speech')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({ text, voice, speed }: { text: string; voice?: string; speed?: number }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: (voice || 'alloy') as OpenAIVoiceId,
        input: text,
        speed: speed || 1.0,
      });

      return response.body as unknown as PassThrough;
    }, 'voice.openai.speechStream')();

    return {
      audioResult: audio,
    };
  }

  async transcribe({ audio }: { audio: Buffer | Blob }) {
    const text = await this.traced(async () => {
      const file = new File([audio], 'audio.wav', { type: 'audio/wav' });

      if (process.env.NODE_ENV === 'development') {
        console.log('Created file:', {
          name: file.name,
          size: file.size,
        });
      }

      const response = await this.client.audio.transcriptions.create({
        model: 'whisper-1',
        file: file as any,
      });

      return response.text;
    }, 'voice.openai.transcribe')();

    return { text };
  }

  /**
   * Transcribe a stream of audio data. Note that Whisper requires the complete audio
   * before starting transcription - this is not real-time transcription.
   *
   * @param audio Audio data stream to transcribe
   * @returns Transcribed text
   */
  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }): Promise<NodeJS.ReadableStream> {
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    audio.on('data', (chunk: Buffer) => chunks.push(chunk));

    audio.on('end', async () => {
      try {
        const audioBuffer = Buffer.concat(chunks);
        const result = await this.transcribe({ audio: audioBuffer });
        outputStream.write(result.text);
        outputStream.end();
      } catch (error) {
        outputStream.destroy(error as Error);
      }
    });

    audio.on('error', error => outputStream.destroy(error));

    return outputStream;
  }
}
