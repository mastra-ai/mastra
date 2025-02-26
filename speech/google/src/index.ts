import { PassThrough } from 'stream';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import type { google as TextToSpeechTypes } from '@google-cloud/text-to-speech/build/protos/protos';
import { MastraTTS } from '@mastra/core/tts';

import { voices } from './voices';
import type { VoiceId } from './voices';

interface GoogleTTSConfig {
  name: VoiceId;
  apiKey?: string;
}

export class GoogleTTS extends MastraTTS {
  client: TextToSpeechClient;

  constructor({ model }: { model: GoogleTTSConfig }) {
    super({
      model: {
        provider: 'GOOGLE',
        ...model,
      },
    });

    this.client = new TextToSpeechClient({
      apiKey: process.env.GOOGLE_API_KEY || this.model.apiKey,
    });
  }

  async voices() {
    return this.traced(() => voices.map(voice => ({ voice_id: voice })), 'tts.google.voices')();
  }

  async generate({ voice, text }: { voice: string; text: string }) {
    const audio = await this.traced(async () => {
      const request: TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: { name: voice as VoiceId, languageCode: voice.split('-').slice(0, 2).join('-') },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const [response] = await this.client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned.');
      }

      if (typeof response.audioContent === 'string') {
        throw new Error('Audio content is a string.');
      }

      return Buffer.from(response.audioContent);
    }, 'tts.google.generate')();

    return {
      audioResult: audio,
    };
  }

  async stream({ voice, text }: { voice: string; text: string }) {
    return this.traced(async () => {
      const request: TextToSpeechTypes.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: { name: voice as VoiceId, languageCode: voice.split('-').slice(0, 2).join('-') },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const [response] = await this.client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content returned.');
      }

      if (typeof response.audioContent === 'string') {
        throw new Error('Audio content is a string.');
      }

      const stream = new PassThrough();
      stream.end(Buffer.from(response.audioContent));

      return { audioResult: stream };
    }, 'tts.google.stream')();
  }
}

// Export available voices for external use
export { voices };
export type { VoiceId, GoogleTTSConfig };

throw new Error(
  '@mastra/speech-google is deprecated. Please use @mastra/voice-google instead. ' +
    "Update your imports from '@mastra/speech-google' to '@mastra/voice-google'.",
);
