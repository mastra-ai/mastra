import { MastraVoice } from '@mastra/core/voice';
import { AZURE_VOICES } from './voices';
import type { VoiceId } from './voices';

type AzureModel = 'tts-1' | 'tts-1-hd' | 'whisper-1'; // searching the docs for what these objects should contain

interface azureVoiceConfig {
  name?: AzureModel
  apiKey?: string;
}

export class azureVoice extends MastraVoice {
  constructor({
    speechModel,
    listeningModel,
    speaker,
  }: {
    speechModel?: azureVoiceConfig,
    listeningModel?: azureVoiceConfig,
    speaker?: VoiceId,
  } = {}) {
    super({
      speechModel: {
        name: '', // needs change
        apiKey: speechModel?.apiKey ?? defaultApiKey, // needs change
      },
      listeningModel: {
        name: '', // needs change
        apiKey: listeningModel?.apiKey ?? defaultApiKey, // needs change
      },
      speaker: speaker ?? defaultSpeaker, // needs change
    });
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