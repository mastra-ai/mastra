import { MastraVoice } from '@mastra/core/voice';
import Azure from 'microsoft-cognitiveservices-speech-sdk';
import { PassThrough } from 'stream';

import { type VoiceId, voices } from './voices';

interface AzureVoiceConfig {
  name: VoiceId;
  apiKey?: string;
  region?: string;
}

export class AzureVoice extends MastraVoice {
  private client: Azure.SpeechSynthesizer;
  private speechConfig: Azure.SpeechConfig;
  private recognizer: Azure.SpeechRecognizer;

  constructor({ model }: { model: AzureVoiceConfig }) {
    super({
      model: {
        provider: 'AZURE',
        ...model,
      },
    });

    const apiKey = process.env.AZURE_API_KEY || model.apiKey;
    const region = process.env.AZURE_REGION || model.region;

    if (!apiKey) {
      throw new Error('AZURE_API_KEY is not set');
    }

    if (!region) {
      throw new Error('AZURE_REGION is not set');
    }

    this.speechConfig = Azure.SpeechConfig.fromSubscription(apiKey, region);
    this.speechConfig.speechSynthesisVoiceName = this.model.name;

    // Configure output format to MP3
    this.speechConfig.speechSynthesisOutputFormat = Azure.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3;

    // Create synthesizer with audio output
    const audioConfig = Azure.AudioConfig.fromDefaultSpeakerOutput();
    this.client = new Azure.SpeechSynthesizer(this.speechConfig, audioConfig);
    this.recognizer = new Azure.SpeechRecognizer(this.speechConfig);
  }

  async voices() {
    return this.traced(() => voices.map(voice => ({ voice_id: voice })), 'voice.azure.voices')();
  }

  async speech({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      if (voice && voice !== this.model.name) {
        this.speechConfig.speechSynthesisVoiceName = voice;
        this.client = new Azure.SpeechSynthesizer(this.speechConfig);
      }

      const result = await new Promise<Buffer>((resolve, reject) => {
        this.client.speakTextAsync(
          text,
          result => {
            const audioData = Buffer.from(result.audioData);
            // result.close(); // Important: close the result to free resources
            resolve(audioData);
          },
          error => {
            reject(error);
          },
        );
      });

      return result;
    }, 'voice.azure.generate')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({ text, voice }: { text: string; voice?: string }) {
    return this.traced(async () => {
      if (voice && voice !== this.model.name) {
        this.speechConfig.speechSynthesisVoiceName = voice;
        this.client = new Azure.SpeechSynthesizer(this.speechConfig);
      }

      const stream = new PassThrough();

      this.client.speakTextAsync(
        text,
        result => {
          stream.write(Buffer.from(result.audioData));
          stream.end();
        },
        error => {
          stream.destroy(error as unknown as Error);
        },
      );

      return { audioResult: stream };
    }, 'voice.azure.speechStream')();
  }

  async transcribe({ audio }: { audio: Buffer | Blob }) {
    return this.traced(async () => {
      const audioConfig = Azure.AudioConfig.fromWavFileInput(audio as Buffer);
      const recognizer = new Azure.SpeechRecognizer(this.speechConfig, audioConfig);

      const result = await new Promise<string>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          result => {
            resolve(result.text);
          },
          error => {
            reject(error);
          },
        );
      });

      return { text: result };
    }, 'voice.azure.transcribe')();
  }

  // @ts-ignore: next line
  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }) {
    return this.traced(async () => {
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        audio.on('data', chunk => chunks.push(chunk));
        audio.on('end', () => resolve());
        audio.on('error', reject);
      });

      const fullAudio = Buffer.concat(chunks);
      const { text } = await this.transcribe({ audio: fullAudio });
      return { text };
    }, 'voice.azure.transcribeStream')();
  }
}

export { voices };
export type { VoiceId, AzureVoiceConfig };
