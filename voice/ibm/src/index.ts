import { MastraVoice } from '@mastra/core/voice';
import { PassThrough } from 'stream';

import { IamAuthenticator } from 'ibm-watson/auth';
import SpeechToTextV1 from 'ibm-watson/speech-to-text/v1';
import TextToSpeechV1 from 'ibm-watson/text-to-speech/v1';
import type { SynthesizeParams } from 'ibm-watson/text-to-speech/v1-generated';

import { IBM_VOICES, type WatsonVoiceId } from './voices';

type IbmConfig = {
  voice?: WatsonVoiceId;
  apiKey?: string;
  url?: string;
  sttUrl?: string;
  properties?: Omit<SynthesizeParams, 'text' | 'voice'>;
};

export class IbmVoice extends MastraVoice {
  private ttsClient: TextToSpeechV1;
  private sttClient: SpeechToTextV1;
  private defaultVoice: WatsonVoiceId;
  private properties?: Omit<SynthesizeParams, 'text' | 'voice'>;

  constructor({ model }: { model: IbmConfig }) {
    super({
      model: {
        provider: 'IBM',
        name: 'IBM',
        ...model,
      },
    });

    const apiKey = process.env.IBM_TTS_API_KEY || model.apiKey;
    const ttsUrl = process.env.IBM_TTS_URL || model.url;
    const sttUrl = process.env.IBM_STT_URL || model.sttUrl;

    if (!apiKey) {
      throw new Error('IBM_TTS_API_KEY is not set');
    }

    if (!ttsUrl) {
      throw new Error('IBM_TTS_URL is not set');
    }

    if (!sttUrl) {
      throw new Error('IBM_STT_URL is not set');
    }

    const authenticator = new IamAuthenticator({ apikey: apiKey });
    this.ttsClient = new TextToSpeechV1({ authenticator, serviceUrl: ttsUrl });
    this.sttClient = new SpeechToTextV1({ authenticator, serviceUrl: sttUrl });
    this.defaultVoice = model.voice || 'en-US_AllisonV3Voice';
    this.properties = model.properties;
  }

  async voices() {
    return this.traced(() => {
      return IBM_VOICES.map(voice => ({
        voice_id: voice,
        name: voice,
        language: voice.split('-')[0],
        gender: 'neutral',
      }));
    }, 'voice.ibm.voices')();
  }

  async speech({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const response = await this.ttsClient.synthesize({
        text,
        accept: 'audio/mpeg',
        voice: (voice || this.defaultVoice) as WatsonVoiceId,
        ...this.properties,
      });

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.result) {
        const part = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        chunks.push(new Uint8Array(part));
      }

      return Buffer.concat(chunks);
    }, 'voice.ibm.speech')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({ text, voice }: { text: string; voice?: string }) {
    const stream = await this.traced(async () => {
      const response = await this.ttsClient.synthesize({
        text,
        accept: 'audio/mpeg',
        voice: (voice || this.defaultVoice) as WatsonVoiceId,
        ...this.properties,
      });

      const outputStream = new PassThrough();

      // Process the stream
      (async () => {
        try {
          for await (const chunk of response.result) {
            const part = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            outputStream.write(new Uint8Array(part));
          }
          outputStream.end();
        } catch (error) {
          outputStream.emit('error', error);
          outputStream.end();
        }
      })();

      return outputStream;
    }, 'voice.ibm.speechStream')();

    return {
      audioResult: stream,
    };
  }

  async transcribe({ audio }: { audio: Buffer | Blob }) {
    return this.traced(async () => {
      let buffer: Buffer;
      if (audio instanceof Blob) {
        buffer = Buffer.from(await audio.arrayBuffer());
      } else {
        buffer = audio;
      }

      const response = await this.sttClient.recognize({
        audio: buffer,
        contentType: 'audio/mpeg',
        model: 'en-US_BroadbandModel',
      });

      if (!response.result.results || response.result.results.length === 0) {
        throw new Error('No transcription results returned');
      }

      const transcription = response.result.results
        .filter(result => result.final) // Only use final results
        .map(result => {
          const alternative = result.alternatives?.[0];
          return alternative?.transcript || '';
        })
        .filter(text => text.length > 0)
        .join(' ');

      if (!transcription) {
        throw new Error('No valid transcription found in results');
      }

      return { text: transcription };
    }, 'voice.ibm.transcribe')();
  }

  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }) {
    return this.traced(async () => {
      const outputStream = new PassThrough({ objectMode: true });

      const recognizeStream = this.sttClient
        .recognizeUsingWebSocket({
          contentType: 'audio/mpeg',
          model: 'en-US_BroadbandModel',
          objectMode: true,
        })
        .on('data', data => {
          if (!data.results || data.results.length === 0) {
            return;
          }

          const transcription = data.results
            .map(result => {
              if (!result.alternatives || result.alternatives.length === 0) {
                return '';
              }
              return result.alternatives[0].transcript || '';
            })
            .filter(text => text.length > 0)
            .join(' ');

          if (transcription) {
            outputStream.write(transcription);
          }
        })
        .on('error', error => {
          outputStream.emit('error', error);
          outputStream.end();
        })
        .on('end', () => {
          outputStream.end();
        });

      audio.pipe(recognizeStream);

      // Handle errors from input stream
      audio.on('error', error => {
        recognizeStream.emit('error', error);
        outputStream.emit('error', error);
        outputStream.end();
      });

      return outputStream;
    }, 'voice.ibm.transcribeStream')();
  }
}

export type { IbmConfig };
