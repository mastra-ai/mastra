import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { MastraVoice } from '.';

export class DefaultVoice extends MastraVoice {
  constructor() {
    super();
  }

  async speak(_input: string | NodeJS.ReadableStream): Promise<NodeJS.ReadableStream> {
    throw new MastraError({
      id: 'VOICE_DEFAULT_NO_SPEAK_PROVIDER',
      text: 'No voice provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  async listen(_input: string | NodeJS.ReadableStream): Promise<string> {
    throw new MastraError({
      id: 'VOICE_DEFAULT_NO_LISTEN_PROVIDER',
      text: 'No voice provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  async getSpeakers(): Promise<{ voiceId: string }[]> {
    throw new MastraError({
      id: 'VOICE_DEFAULT_NO_SPEAKERS_PROVIDER',
      text: 'No voice provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  async getListener(): Promise<{ enabled: boolean }> {
    throw new MastraError({
      id: 'VOICE_DEFAULT_NO_LISTENER_PROVIDER',
      text: 'No voice provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }
}
