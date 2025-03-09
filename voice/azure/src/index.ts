import { PassThrough } from 'stream';
import { MastraVoice } from '@mastra/core/voice';
import * as Azure from 'microsoft-cognitiveservices-speech-sdk';
import { AZURE_VOICES } from './voices';
import type { VoiceId } from './voices';

interface AzureVoiceConfig {
  apiKey?: string;
  region?: string;
  voiceName?: string;   // e.g., "en-US-AriaNeural" for TTS
  language?: string;    // e.g., "en-US" for STT
}

// If you already have a type for your speaker:
// type VoiceId = string; // im importing this from voices.ts file

export class AzureVoice extends MastraVoice {
  speechConfig?: Azure.SpeechConfig;        // for TTS
  listeningConfig?: Azure.SpeechConfig;     // for STT
  speechSynthesizer?: Azure.SpeechSynthesizer; // TTS
  speechRecognizer?: Azure.SpeechRecognizer; // STT

  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: {
    speechModel?: AzureVoiceConfig,
    listeningModel?: AzureVoiceConfig,
    speaker?: VoiceId,
  } = {}) {
    super({
      speechModel: {
        name: '',
        apiKey: speechModel?.apiKey ?? process.env.AZURE_API_KEY,
      },
      listeningModel: {
        name: '',
        apiKey: listeningModel?.apiKey ?? process.env.AZURE_API_KEY,
      },
      speaker: speaker
    });

    const speechApiKey = speechModel?.apiKey ?? process.env.AZURE_API_KEY;
    const speechRegion = speechModel?.region ?? process.env.AZURE_REGION;

    const listeningApiKey = listeningModel?.apiKey ?? process.env.AZURE_API_KEY;
    const listeningRegion = listeningModel?.region ?? process.env.AZURE_REGION;

    if (!speechApiKey && !listeningApiKey) {
      throw new Error('No Azure API key provided for either speech or listening model.');
    }
    
    if (speechApiKey && speechRegion) {
      this.speechConfig = Azure.SpeechConfig.fromSubscription(speechApiKey, speechRegion);

      const defaultVoiceName = speechModel?.voiceName || speaker || 'en-US-AriaNeural';
      this.speechConfig.speechSynthesisVoiceName = defaultVoiceName;
      this.speechSynthesizer = new Azure.SpeechSynthesizer(this.speechConfig);
    } else {
      throw new Error('AZURE_REGION is not set (for the speech model).');
    }

    if (listeningApiKey && listeningRegion) {
      this.listeningConfig = Azure.SpeechConfig.fromSubscription(listeningApiKey, listeningRegion);

      if (listeningModel?.language) {
        this.listeningConfig.speechRecognitionLanguage = listeningModel.language;
      }

      this.speechRecognizer = new Azure.SpeechRecognizer(this.listeningConfig);
    } else{
      throw new Error('AZURE_REGION is not set (for the listening model).');
    }
  }

  async getSpeakers() {
    return this.traced(async () => {
      return AZURE_VOICES.map(voice => ({
        voiceId: voice,
        language: voice.split('-')[0],
        region: voice.split('-')[1],
      }));
    }, 'voice.azure.voices')();
  }
  
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      [key: string]: any;
    },
  ): Promise<NodeJS.ReadableStream> {
    if (!this.speechConfig) {
      throw new Error('Speech model (Azure) not configured');
    }

    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(chunk as Buffer);
      }
      input = Buffer.concat(chunks).toString('utf-8');
    }

    if (!input.trim()) {
      throw new Error('Input text is empty');
    }

    const pushStream = Azure.AudioOutputStream.createPushStream();
    const passThrough = new PassThrough();

    pushStream.write = (buffer: ArrayBuffer) => {
      passThrough.write(Buffer.from(buffer));
      return true;
    };
    pushStream.onDetached = () => passThrough.end();

    const audioConfig = Azure.AudioConfig.fromStreamOutput(pushStream);
    if (options?.speaker) {
      this.speechConfig.speechSynthesisVoiceName = options.speaker;
    }

    const synthesizer = new Azure.SpeechSynthesizer(this.speechConfig, audioConfig);

    await this.traced(
      () =>
        new Promise<void>((resolve, reject) => {
          synthesizer.speakTextAsync(
            input,
            (result) => {
              synthesizer.close();
              result.reason === Azure.ResultReason.SynthesizingAudioCompleted
                ? resolve()
                : reject(new Error(`Speech synthesis failed. Reason: ${result.reason}`));
            },
            (error) => {
              synthesizer.close();
              reject(error);
            },
          );
        }),
      'voice.azure.speak'
    )();
    return passThrough;
  }

  /**
   * Transcribes audio (STT) from a Node.js stream using Azure.
   *
   * @param {NodeJS.ReadableStream} audioStream - The audio to be transcribed.
   * @param {Object} [options] - Optional params (filetype, etc.).
   * @param {string} [options.filetype] - 'mp3', 'wav', etc. (not crucial here).
   * @returns {Promise<string>} - The recognized text.
   */
  async listen() {}
}
