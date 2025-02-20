import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { google as TextToSpeechTypes } from '@google-cloud/text-to-speech/build/protos/protos';
import { MastraVoice } from '@mastra/core/voice';
import { PassThrough } from 'stream';

import { type VoiceId, voices } from './voices';

interface GoogleVoiceConfig {
  name: VoiceId;
  apiKey?: string;
}

export class GoogleVoice extends MastraVoice {
  private ttsClient: TextToSpeechClient;
  private speechClient: SpeechClient;

  constructor({ model }: { model: GoogleVoiceConfig }) {
    super({
      model: {
        provider: 'GOOGLE',
        ...model,
      },
    });

    const apiKey = process.env.GOOGLE_API_KEY || model.apiKey;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set');
    }

    this.ttsClient = new TextToSpeechClient({
      apiKey,
    });

    this.speechClient = new SpeechClient({
      apiKey,
    });
  }

  async voices() {
    return this.traced(() => voices.map(voice => ({ voice_id: voice })), 'voice.google.voices')();
  }

  async speech({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const request: TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: {
          name: (voice || voices[0]) as VoiceId,
          languageCode: voice?.split('-').slice(0, 2).join('-') || 'en-US',
        },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned.');
      }

      if (typeof response.audioContent === 'string') {
        throw new Error('Audio content is a string.');
      }

      return Buffer.from(response.audioContent);
    }, 'voice.google.speech')();

    return {
      audioResult: audio,
    };
  }

  async speechStream({ text, voice }: { text: string; voice?: string }) {
    const audio = await this.traced(async () => {
      const request: TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: {
          name: (voice || voices[0]) as VoiceId,
          languageCode: voice?.split('-').slice(0, 2).join('-') || 'en-US',
        },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const [response] = await this.ttsClient.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned.');
      }

      if (typeof response.audioContent === 'string') {
        throw new Error('Audio content is a string.');
      }

      const stream = new PassThrough();
      stream.end(Buffer.from(response.audioContent));

      return stream;
    }, 'voice.google.speechStream')();

    return {
      audioResult: audio,
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

      const request = {
        config: {
          encoding: 'MP3',
          sampleRateHertz: 44100,
          languageCode: 'en-US',
        },
        audio: {
          content: buffer.toString('base64'),
        },
      };

      const [response] = await this.speechClient.recognize(request);

      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results returned');
      }

      const transcription = response.results
        .map(result => {
          if (!result.alternatives || result.alternatives.length === 0) {
            return '';
          }
          return result.alternatives[0].transcript || '';
        })
        .filter(text => text.length > 0)
        .join(' ');

      if (!transcription) {
        throw new Error('No valid transcription found in results');
      }

      return { text: transcription };
    }, 'voice.google.transcribe')();
  }

  async transcribeStream({ audio }: { audio: NodeJS.ReadableStream }) {
    return this.traced(async () => {
      // Create intermediate stream to handle audio data
      const audioStream = new PassThrough();
      audio.pipe(audioStream);

      // Create output stream for transcription results
      const outputStream = new PassThrough({ objectMode: true });

      const recognizeStream = this.speechClient
        .streamingRecognize({
          config: {
            encoding: 'MP3',
            sampleRateHertz: 44100,
            languageCode: 'en-US',
          },
          interimResults: false,
        })
        .on('error', error => {
          outputStream.emit('error', error);
          outputStream.end();
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
        .on('end', () => {
          outputStream.end();
        });

      audioStream.pipe(recognizeStream);

      // Handle errors from input stream
      audio.on('error', error => {
        audioStream.emit('error', error);
        recognizeStream.emit('error', error);
        outputStream.emit('error', error);
        outputStream.end();
      });

      return outputStream;
    }, 'voice.google.transcribeStream')();
  }
}

// Export available voices for external use
export { voices };
export type { VoiceId, GoogleVoiceConfig };
