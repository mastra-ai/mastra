import { MastraVoice } from '@mastra/core/voice';

import { AZURE_VOICES } from './voices';

export class azureVoice extends MastraVoice {
  constructor() {
    super();
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