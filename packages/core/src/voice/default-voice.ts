import { MastraVoice } from '.';

export class DefaultVoice extends MastraVoice {
  constructor() {
    super();
  }

  async speak(_input: string | NodeJS.ReadableStream): Promise<NodeJS.ReadableStream> {
    throw new Error('No voice provider configured');
  }

  async listen(_input: string | NodeJS.ReadableStream): Promise<string> {
    throw new Error('No voice provider configured');
  }

  async getSpeakers(): Promise<{ voiceId: string }[]> {
    throw new Error('No voice provider configured');
  }
}
