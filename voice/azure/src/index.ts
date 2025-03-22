import { Readable } from 'stream';
import { MastraVoice } from '@mastra/core/voice';
import * as Azure from 'microsoft-cognitiveservices-speech-sdk';
import { AZURE_VOICES } from './voices';
import type { VoiceId } from './voices';

interface AzureVoiceConfig {
  apiKey?: string;
  region?: string;
  voiceName?: string;
  language?: string;
}

export class AzureVoice extends MastraVoice {
  private speechConfig?: Azure.SpeechConfig;
  private listeningConfig?: Azure.SpeechConfig;
  private speechSynthesizer?: Azure.SpeechSynthesizer;
  private speechRecognizer?: Azure.SpeechRecognizer;

  /**
   * Creates a new instance of AzureVoice for text-to-speech and speech-to-text services.
   *
   * @param {Object} config - Configuration options
   * @param {AzureVoiceConfig} [config.speechModel] - Configuration for text-to-speech
   * @param {AzureVoiceConfig} [config.listeningModel] - Configuration for speech-to-text
   * @param {VoiceId} [config.speaker] - Default voice ID for speech synthesis
   */
  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: {
    speechModel?: AzureVoiceConfig;
    listeningModel?: AzureVoiceConfig;
    speaker?: VoiceId;
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
      speaker,
    });

    const envApiKey = process.env.AZURE_API_KEY;
    const envRegion = process.env.AZURE_REGION;

    // Configure speech synthesis
    if (speechModel) {
      const apiKey = speechModel.apiKey ?? envApiKey;
      const region = speechModel.region ?? envRegion;

      if (!apiKey) throw new Error('No Azure API key provided for speech model');
      if (!region) throw new Error('No region provided for speech model');

      this.speechConfig = Azure.SpeechConfig.fromSubscription(apiKey, region);
      this.speechConfig.speechSynthesisVoiceName = speechModel.voiceName || speaker || 'en-US-AriaNeural';
      this.speechSynthesizer = new Azure.SpeechSynthesizer(this.speechConfig);
    }

    // Configure speech recognition
    if (listeningModel) {
      const apiKey = listeningModel.apiKey ?? envApiKey;
      const region = listeningModel.region ?? envRegion;

      if (!apiKey) throw new Error('No Azure API key provided for listening model');
      if (!region) throw new Error('No region provided for listening model');

      this.listeningConfig = Azure.SpeechConfig.fromSubscription(apiKey, region);
      if (listeningModel.language) {
        this.listeningConfig.speechRecognitionLanguage = listeningModel.language;
      }
      this.speechRecognizer = new Azure.SpeechRecognizer(this.listeningConfig);
    }
  }

  /**
   * Gets a list of available voices for speech synthesis.
   *
   * @returns {Promise<Array<{ voiceId: string; language: string; region: string; }>>} List of available voices
   */
  async getSpeakers() {
    return this.traced(async () => {
      return AZURE_VOICES.map(voice => ({
        voiceId: voice,
        language: voice.split('-')[0],
        region: voice.split('-')[1],
      }));
    }, 'voice.azure.voices')();
  }

  /**
   * Converts text to speech using Azure's Text-to-Speech service.
   *
   * @param {string | NodeJS.ReadableStream} input - Text to convert to speech
   * @param {Object} [options] - Optional parameters
   * @param {string} [options.speaker] - Voice ID to use for synthesis
   * @returns {Promise<NodeJS.ReadableStream>} Stream containing the synthesized audio
   * @throws {Error} If speech model is not configured or synthesis fails
   */
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

    // Convert stream input to string if needed
    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      try {
        for await (const chunk of input) {
          chunks.push(chunk as Buffer);
        }
        input = Buffer.concat(chunks).toString('utf-8');
      } catch (error) {
        throw new Error(`Failed to read input stream: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!input?.trim()) {
      throw new Error('Input text is empty');
    }

    // Update voice if specified
    if (options?.speaker) {
      this.speechConfig.speechSynthesisVoiceName = options.speaker;
    }

    const synthesizer = new Azure.SpeechSynthesizer(this.speechConfig);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Speech synthesis timed out')), 5000);
      });

      const synthesisPromise = this.traced(
        () =>
          new Promise<Azure.SpeechSynthesisResult>((resolve, reject) => {
            synthesizer.speakTextAsync(
              input,
              result =>
                result.errorDetails
                  ? reject(new Error(`Speech synthesis failed: ${result.errorDetails}`))
                  : resolve(result),
              error => reject(new Error(`Speech synthesis error: ${String(error)}`)),
            );
          }),
        'voice.azure.speak',
      )();

      const result = await Promise.race([synthesisPromise, timeoutPromise]);
      synthesizer.close();

      if (result.reason !== Azure.ResultReason.SynthesizingAudioCompleted) {
        throw new Error(`Speech synthesis failed: ${result.errorDetails || result.reason}`);
      }

      return Readable.from([Buffer.from(result.audioData)]);
    } catch (error) {
      synthesizer.close();
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Transcribes audio (STT) from a Node.js stream using Azure.
   *
   * @param {NodeJS.ReadableStream} audioStream - The audio to be transcribed, must be in .wav format.
   * @returns {Promise<string>} - The recognized text.
   */
  async listen(audioStream: NodeJS.ReadableStream): Promise<string> {
    if (!this.listeningConfig || !this.speechRecognizer) {
      throw new Error('Listening model (Azure) not configured');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer);
    }
    const audioData = Buffer.concat(chunks);

    const pushStream = Azure.AudioInputStream.createPushStream();
    const audioConfig = Azure.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new Azure.SpeechRecognizer(this.listeningConfig, audioConfig);

    try {
      const recognitionPromise = new Promise<string>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          result => {
            if (result.reason === Azure.ResultReason.RecognizedSpeech) {
              resolve(result.text);
            } else {
              const reason = Azure.ResultReason[result.reason] || result.reason;
              reject(new Error(`Speech recognition failed: ${reason} - ${result.errorDetails || ''}`));
            }
          },
          error => reject(new Error(`Speech recognition error: ${String(error)}`)),
        );
      });

      const chunkSize = 4096;
      for (let i = 0; i < audioData.length; i += chunkSize) {
        const chunk = audioData.slice(i, i + chunkSize);
        pushStream.write(chunk);
      }
      pushStream.close();

      const text = await this.traced(() => recognitionPromise, 'voice.azure.listen')();

      return text;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    } finally {
      recognizer.close();
    }
  }
}
