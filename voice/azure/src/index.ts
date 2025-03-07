import { PassThrough } from 'stream';
import { MastraVoice } from '@mastra/core/voice';
import * as Azure from 'microsoft-cognitiveservices-speech-sdk';
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
  
  async speak() {
    
  }
  
  async listen() {
  
  }
}
