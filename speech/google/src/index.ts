import textToSpeech from '@google-cloud/text-to-speech';
import type { google as TextToSpeechTypes } from '@google-cloud/text-to-speech/build/protos/protos';
import { MastraTTS } from '@mastra/core';

import { type VoiceId, voices } from './voices';

interface GoogleTTSConfig {
  name: VoiceId;
  apiKey?: string;
}

export class GoogleTTS extends MastraTTS {
  client: textToSpeech.TextToSpeechClient;

  constructor({ model }: { model: GoogleTTSConfig }) {
    super({
      model: {
        provider: 'GOOGLE',
        ...model,
      },
    });

    this.client = new textToSpeech.TextToSpeechClient({
      apiKey: process.env.GOOGLE_API_KEY || this.model.apiKey,
    });
  }

  /**
   * Retrieves a list of available voices for the Google TTS provider
   * @returns {Promise<Array<{ voice_id: VoiceId }>>} List of available voices
   */
  async voices() {
    return this.traced(() => voices.map(voice => ({ voice_id: voice })), 'tts.google.voices')();
  }

  /**
   * Generates synthesized audio using the Google Cloud TTS API
   * @param {string} voice - The voice model to use for synthesis
   * @param {string} text - The text to convert to speech
   * @returns {Promise<{ audio: Buffer; type: string }>} The synthesized audio data
   * @throws {Error} If synthesis fails or no audio content is returned
   */
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
      audio,
      type: 'audio/mpeg',
    };
  }
}

// Export available voices for external use
export { voices };
export type { VoiceId, GoogleTTSConfig };
